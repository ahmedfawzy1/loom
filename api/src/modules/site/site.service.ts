import { AuditAction, DEFAULT_SITE_LANGUAGES, type Site } from "@loom/database";
import type {
  CreateSiteRequestDto,
  UpdateSiteLanguageRequestDto,
  UpdateSiteRequestDto,
} from "@loom/dto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiKeyService } from "../api-key/api-key.service";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { RevalidateService } from "../revalidate/revalidate.service";
import { DEFAULT_SPACE_NAME } from "../space/space.constants";
import { slugifySpaceName } from "../space/space.util";

const SITE_INCLUDE = {
  languages: { orderBy: { position: "asc" } },
  spaces: { orderBy: { name: "asc" } },
} as const;

@Injectable()
export class SiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly revalidate: RevalidateService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  listSites() {
    return this.prisma.site.findMany({
      include: SITE_INCLUDE,
      orderBy: { name: "asc" },
    });
  }

  async getSite(siteId: Site["id"]) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: SITE_INCLUDE,
    });
    if (!site) throw new NotFoundException(`Site ${siteId} not found`);
    return site;
  }

  async createSite(actor: AuthenticatedUser, args: CreateSiteRequestDto) {
    // A Site needs both to be usable at all, and nothing else creates either: with no languages it
    // can publish nothing, and with no Space it can hold nothing — the same invariant deleteSpace
    // already enforces from the other end. Enabling and reordering is what updateLanguages is for.
    // The default language must be one of those rows, or every translation source lookup fails.
    const defaultLanguage = args.defaultLanguage ?? "en";
    if (!DEFAULT_SITE_LANGUAGES.some(({ code }) => code === defaultLanguage))
      throw new BadRequestException(
        `${defaultLanguage} is not one of the languages a new Site starts with`,
      );
    // Checked up front so the answer names the slug, rather than a bare unique-constraint conflict
    const taken = await this.prisma.site.findUnique({
      where: { slug: args.slug },
      select: { id: true },
    });
    if (taken)
      throw new ConflictException(
        `A Site with the slug "${args.slug}" already exists`,
      );

    const site = await this.prisma.site.create({
      data: {
        ...args,
        languages: {
          create: DEFAULT_SITE_LANGUAGES.map((language, position) => ({
            ...language,
            position,
          })),
        },
        spaces: {
          create: {
            name: DEFAULT_SPACE_NAME,
            slug: slugifySpaceName(DEFAULT_SPACE_NAME),
            featuredArticles: { create: {} },
          },
        },
      },
      include: SITE_INCLUDE,
    });

    await this.auditService.log(actor, {
      action: AuditAction.SITE_CREATED,
      contentId: site.id,
      metadata: { slug: site.slug },
    });

    return site;
  }

  /**
   * Permanent. Every Space with all its content and history, the Site's languages, API keys and
   * translation usage go with it: they all cascade from the Site. Media stays, because the library
   * is shared by every Site.
   */
  async deleteSite(
    actor: AuthenticatedUser,
    siteId: Site["id"],
    confirmName: Site["name"],
  ) {
    const site = await this.getSite(siteId);

    if (confirmName !== site.name)
      throw new BadRequestException(
        "Type the Site name exactly to confirm deletion",
      );

    // The same invariant deleteSpace keeps one level down: the admin always has a Site to work in
    const remaining = await this.prisma.site.count({
      where: { id: { not: siteId } },
    });
    if (remaining === 0)
      throw new BadRequestException("Loom must keep at least one Site");

    await this.prisma.site.delete({ where: { id: siteId } });
    this.apiKeyService.forgetSite(siteId);

    // The audit log keeps no foreign key to Sites, so the entry outlives the row
    await this.auditService.log(actor, {
      action: AuditAction.SITE_DELETED,
      contentId: site.id,
      metadata: {
        name: site.name,
        slug: site.slug,
        spaces: site.spaces.map((space) => space.name),
      },
    });
  }

  async updateSite(
    actor: AuthenticatedUser,
    siteId: Site["id"],
    args: UpdateSiteRequestDto,
  ) {
    const existing = await this.getSite(siteId);

    if (args.defaultLanguage) {
      const language = existing.languages.find(
        (candidate) => candidate.code === args.defaultLanguage,
      );
      // Without this the default can name a language that has no row, after which the guard in
      // updateLanguages never matches and every translation source lookup fails.
      if (!language)
        throw new BadRequestException(
          `${args.defaultLanguage} is not one of this Site's languages`,
        );
      if (!language.enabled)
        throw new BadRequestException(
          `${args.defaultLanguage} is disabled — enable it before making it the default`,
        );
    }

    // The URL is fetched by the server; in production only a public https address is meant to be there
    if (
      args.revalidateUrl &&
      this.configService.get<string>("NODE_ENV") === "production" &&
      !args.revalidateUrl.startsWith("https://")
    )
      throw new BadRequestException("The refresh URL must use https");
    // Opened in editors' browsers carrying a token, which plain http would expose on the way
    if (
      args.previewUrl &&
      this.configService.get<string>("NODE_ENV") === "production" &&
      !args.previewUrl.startsWith("https://")
    )
      throw new BadRequestException("The preview URL must use https");

    const site = await this.prisma.site.update({
      where: { id: siteId },
      data: args,
      include: SITE_INCLUDE,
    });

    await this.auditService.log(actor, {
      action: AuditAction.SITE_UPDATED,
      contentId: siteId,
      metadata: { fields: Object.keys(args) },
    });

    // A new default language changes the shared fields every language is served
    if (
      args.defaultLanguage &&
      args.defaultLanguage !== existing.defaultLanguage
    )
      this.revalidate.siteChanged(siteId);

    return site;
  }

  async updateProtectedTerms(
    actor: AuthenticatedUser,
    siteId: Site["id"],
    protectedTerms: Site["protectedTerms"],
  ) {
    await this.getSite(siteId);

    const site = await this.prisma.site.update({
      where: { id: siteId },
      data: { protectedTerms },
      include: SITE_INCLUDE,
    });

    await this.auditService.log(actor, {
      action: AuditAction.SETTINGS_CHANGED,
      contentId: siteId,
      metadata: { setting: "protectedTerms", count: protectedTerms.length },
    });

    return site;
  }

  async updateLanguages(
    actor: AuthenticatedUser,
    siteId: Site["id"],
    languages: UpdateSiteLanguageRequestDto[],
  ) {
    const site = await this.getSite(siteId);
    const known = new Set(site.languages.map((language) => language.code));

    const unknown = languages.filter((language) => !known.has(language.code));
    if (unknown.length)
      throw new BadRequestException(
        `Unknown language codes: ${unknown.map((language) => language.code).join(", ")}`,
      );

    const disablingDefault = languages.find(
      (language) =>
        language.code === site.defaultLanguage && language.enabled === false,
    );
    if (disablingDefault)
      throw new BadRequestException(
        "The default language cannot be disabled — change the default first",
      );

    await this.prisma.$transaction(
      languages.map(({ code, ...data }) =>
        this.prisma.siteLanguage.update({
          where: { siteId_code: { siteId, code } },
          data,
        }),
      ),
    );
    // Enabling or disabling a language changes every page's alternates, and what the API serves
    if (
      languages.some(
        (language) =>
          language.enabled !== undefined &&
          language.enabled !==
            site.languages.find((existing) => existing.code === language.code)
              ?.enabled,
      )
    )
      this.revalidate.siteChanged(siteId);

    await this.auditService.log(actor, {
      action: AuditAction.SETTINGS_CHANGED,
      contentId: siteId,
      metadata: {
        setting: "languages",
        codes: languages.map((language) => language.code),
      },
    });

    return this.getSite(siteId);
  }
}
