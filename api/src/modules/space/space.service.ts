import { AuditAction, type Site, type Space } from "@loom/database";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import {
  SPACE_CLONE_MAX_WAIT_MS,
  SPACE_CLONE_TIMEOUT_MS,
} from "./space.constants";
import { slugifySpaceName } from "./space.util";
import { SpaceCloneService } from "./space-clone.service";

@Injectable()
export class SpaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cloneService: SpaceCloneService,
  ) {}

  listSpaces(siteId: Site["id"]) {
    return this.prisma.space.findMany({
      where: { siteId },
      orderBy: { name: "asc" },
    });
  }

  async getSpace(spaceId: Space["id"]) {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
    });
    if (!space) throw new NotFoundException(`Space ${spaceId} not found`);
    return space;
  }

  async createSpace(
    actor: AuthenticatedUser,
    siteId: Site["id"],
    name: Space["name"],
    cloneFromSpaceId?: Space["id"],
  ) {
    const slug = slugifySpaceName(name);
    await this.assertNameAvailable(siteId, name, slug);

    if (!cloneFromSpaceId) {
      const space = await this.prisma.space.create({
        // The FeaturedArticles singleton comes with the Space on every path that creates one, so
        // nothing downstream has to handle a Space that lacks it
        data: { siteId, name, slug, featuredArticles: { create: {} } },
      });

      await this.auditService.log(actor, {
        action: AuditAction.SPACE_CREATED,
        spaceId: space.id,
        metadata: { name },
      });

      return space;
    }

    const source = await this.getSpace(cloneFromSpaceId);
    if (source.siteId !== siteId)
      throw new BadRequestException(
        "A Space can only be cloned from another Space on the same Site",
      );

    const space = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.space.create({ data: { siteId, name, slug } });
        await this.cloneService.cloneInto(tx, source, created);
        return created;
      },
      {
        timeout: SPACE_CLONE_TIMEOUT_MS,
        maxWait: SPACE_CLONE_MAX_WAIT_MS,
      },
    );

    await this.auditService.log(actor, {
      action: AuditAction.SPACE_CLONED,
      spaceId: space.id,
      metadata: { name, clonedFrom: source.name },
    });

    return space;
  }

  /**
   * Checked before the clone transaction opens rather than left to the unique constraint. A clone
   * can run for a minute, so a name collision discovered at commit time surfaces long after the
   * operator could act on it — and if the client gave up first, their retry is what hits it.
   */
  /** A new Space's slug is checked too; a rename leaves the slug alone, so only the name is. */
  private async assertNameAvailable(
    siteId: Site["id"],
    name: Space["name"],
    slug?: Space["slug"],
  ) {
    const clash = await this.prisma.space.findFirst({
      where: { siteId, OR: [{ name }, ...(slug ? [{ slug }] : [])] },
    });
    if (clash)
      throw new ConflictException(
        clash.name === name
          ? `This Site already has a Space named "${name}"`
          : `"${name}" produces the URL slug "${slug}", which "${clash.name}" already uses`,
      );
  }

  async renameSpace(
    actor: AuthenticatedUser,
    spaceId: Space["id"],
    name: Space["name"],
  ) {
    const existing = await this.getSpace(spaceId);
    if (name !== existing.name)
      await this.assertNameAvailable(existing.siteId, name);

    // The slug is how the website asks for this Space, so it is fixed when the Space is made:
    // re-deriving it here would take the website offline
    const space = await this.prisma.space.update({
      where: { id: spaceId },
      data: { name },
    });

    await this.auditService.log(actor, {
      action: AuditAction.SPACE_RENAMED,
      spaceId,
      metadata: { from: existing.name, to: name },
    });

    return space;
  }

  async deleteSpace(
    actor: AuthenticatedUser,
    spaceId: Space["id"],
    confirmName: Space["name"],
  ) {
    const space = await this.getSpace(spaceId);

    if (confirmName !== space.name)
      throw new BadRequestException(
        "Type the Space name exactly to confirm deletion",
      );

    const remaining = await this.prisma.space.count({
      where: { siteId: space.siteId, id: { not: spaceId } },
    });
    if (remaining === 0)
      throw new BadRequestException("A Site must keep at least one Space");

    // Audited before the cascade, so the entry survives the row
    await this.auditService.log(actor, {
      action: AuditAction.SPACE_DELETED,
      spaceId,
      metadata: { name: space.name },
    });

    await this.prisma.space.delete({ where: { id: spaceId } });
  }
}
