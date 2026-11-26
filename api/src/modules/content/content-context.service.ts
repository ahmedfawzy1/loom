import type { SiteLanguage, Space } from "@loom/database";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ContentContextService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A Space with its Site's language configuration. Content writes need the default language to
   * know which locale a create call is filling, and lists need it for the title fallback.
   */
  async requireSpace(spaceId: Space["id"]) {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      include: { site: { include: { languages: true } } },
    });
    if (!space) throw new NotFoundException(`Space ${spaceId} not found`);
    return space;
  }

  async requireLanguage(spaceId: Space["id"], code: SiteLanguage["code"]) {
    const space = await this.requireSpace(spaceId);
    const language = space.site.languages.find(
      (candidate) => candidate.code === code,
    );
    if (!language)
      throw new NotFoundException(
        `${code} is not a language on ${space.site.name}`,
      );
    return { space, language };
  }
}
