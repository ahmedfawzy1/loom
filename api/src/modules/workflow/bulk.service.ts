import { CmsContentType, CmsRole, type SiteLanguage } from "@loom/database";
import type {
  BulkRequestDto,
  BulkResultResponseDto,
  LiveUsageResponseDto,
} from "@loom/dto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { liveBlogVersionsContaining } from "../content/body-references.util";
import {
  type CanonicalRow,
  canonicalDelegate,
  type LocaleRow,
  localeDelegate,
} from "../content/content-item.util";
import { contentKind } from "../content/content-kind.registry";
import { contentTitles, refKey } from "../content/content-titles.util";
import { publish, submit, unpublish } from "../content/workflow.util";
import { PrismaService } from "../prisma/prisma.service";
import { RevalidateService } from "../revalidate/revalidate.service";
import { PublishService } from "./publish.service";
import { TrashService } from "./trash.service";

type Outcome = Omit<BulkResultResponseDto, "id" | "title" | "languageCode">;

const done: Outcome = { outcome: "done", message: null };
const skipped = (message: string): Outcome => ({ outcome: "skipped", message });

// Publishing is for those who may publish, submitting only for Writers, who cannot
const ALLOWED: Record<BulkRequestDto["action"], CmsRole[]> = {
  publish: [CmsRole.ADMIN, CmsRole.AUTHOR],
  unpublish: [CmsRole.ADMIN, CmsRole.AUTHOR],
  submit: [CmsRole.WRITER],
  trash: [CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER],
  restore: [CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER],
};

/**
 * One action over many items, through the same services a single item goes through, so
 * every rule, gate and audit entry applies to each. Items are independent: one refusing does not
 * stop the rest, and each reports what happened. What is nothing to do — no version in that
 * language, already live — is reported as skipped rather than failed. The website is told once, at
 * the end, about every page the batch touched.
 */
@Injectable()
export class BulkService {
  private readonly logger = new Logger(BulkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publishService: PublishService,
    private readonly trashService: TrashService,
    private readonly revalidate: RevalidateService,
  ) {}

  async run(
    actor: AuthenticatedUser,
    type: CmsContentType,
    args: BulkRequestDto,
  ): Promise<BulkResultResponseDto[]> {
    if (type === CmsContentType.FEATURED_ARTICLES)
      throw new BadRequestException(
        "Featured Articles is one list per Space — open it to publish it",
      );
    if (!ALLOWED[args.action].includes(actor.role))
      throw new ForbiddenException(
        `Bulk ${args.action} is for ${ALLOWED[args.action].join(" and ")}`,
      );
    const perLanguage = !["trash", "restore"].includes(args.action);
    if (perLanguage && !args.languages?.length)
      throw new BadRequestException(`Choose the languages to ${args.action}`);

    const kind = contentKind(type);
    const [items, locales, titles] = await Promise.all([
      canonicalDelegate(this.prisma, type).findMany({
        where: { id: { in: args.ids } },
      }),
      perLanguage
        ? (localeDelegate(this.prisma, type).findMany({
            where: {
              [kind.localeForeignKey]: { in: args.ids },
              languageCode: { in: args.languages },
            },
          }) as Promise<(LocaleRow & Record<string, unknown>)[]>)
        : Promise.resolve([]),
      contentTitles(
        this.prisma,
        args.ids.map((id) => ({ type, id })),
        args.languages?.[0] ?? "",
      ),
    ]);

    return this.revalidate.batch(async () => {
      const results: BulkResultResponseDto[] = [];
      for (const id of args.ids) {
        const title = titles.get(refKey({ type, id })) ?? id;
        const item = items.find((candidate) => candidate.id === id);
        if (!perLanguage) {
          results.push({
            id,
            title,
            languageCode: null,
            ...(await this.onItem(actor, type, args.action, item, id)),
          });
          continue;
        }
        for (const languageCode of args.languages ?? [])
          results.push({
            id,
            title,
            languageCode,
            ...(await this.onLanguage(
              actor,
              type,
              args.action,
              id,
              languageCode,
              locales.find(
                (locale) =>
                  locale[kind.localeForeignKey] === id &&
                  locale.languageCode === languageCode,
              ),
            )),
          });
      }
      return results;
    });
  }

  /**
   * Live posts that show an item — its byline, category, tag, or an embed or link in the body.
   * Unpublishing or trashing the item takes it off all of them, so the screens say so first.
   */
  async liveUsage(
    type: CmsContentType,
    id: CanonicalRow["id"],
  ): Promise<LiveUsageResponseDto[]> {
    if (type === CmsContentType.FEATURED_ARTICLES) return [];
    const versions = (await liveBlogVersionsContaining(this.prisma, id)).filter(
      (version) => !version.deletedAt && version.blogId !== id,
    );
    const posts = new Map<string, LiveUsageResponseDto>();
    for (const version of versions) {
      const post = posts.get(version.blogId) ?? {
        id: version.blogId,
        title: version.title,
        languageCodes: [],
      };
      post.languageCodes.push(version.languageCode);
      posts.set(version.blogId, post);
    }
    return [...posts.values()];
  }

  private async onItem(
    actor: AuthenticatedUser,
    type: CmsContentType,
    action: BulkRequestDto["action"],
    item: CanonicalRow | undefined,
    id: CanonicalRow["id"],
  ): Promise<Outcome> {
    if (!item) return { outcome: "failed", message: "It no longer exists" };
    if (action === "trash" && item.deletedAt)
      return skipped("Already in the Trash");
    if (action === "restore" && !item.deletedAt)
      return skipped("Not in the Trash");
    return this.attempt(() =>
      action === "trash"
        ? this.trashService.trash(actor, type, id)
        : this.trashService.restore(actor, type, id),
    );
  }

  private async onLanguage(
    actor: AuthenticatedUser,
    type: CmsContentType,
    action: BulkRequestDto["action"],
    id: CanonicalRow["id"],
    languageCode: SiteLanguage["code"],
    locale: LocaleRow | undefined,
  ): Promise<Outcome> {
    if (!locale) return skipped(`No ${languageCode} version`);
    // The workflow's own rule, asked first: every state it refuses is one with nothing to do —
    // already live, not live, already in review — so it is a skip, not a failure
    const rule = {
      publish: () => publish(locale, actor.id, new Date()),
      unpublish: () => unpublish(locale),
      submit: () => submit(locale, actor.id, new Date()),
    }[action as "publish" | "unpublish" | "submit"];
    try {
      rule();
    } catch (error) {
      if (error instanceof ConflictException) return skipped(error.message);
      throw error;
    }

    return this.attempt(() =>
      action === "publish"
        ? this.publishService.publish(actor, type, id, languageCode)
        : action === "unpublish"
          ? this.publishService.unpublish(actor, type, id, languageCode)
          : this.publishService.submit(actor, type, id, languageCode),
    );
  }

  private async attempt(work: () => Promise<unknown>): Promise<Outcome> {
    try {
      await work();
      return done;
    } catch (error) {
      if (error instanceof HttpException) {
        const body = error.getResponse();
        const message =
          typeof body === "object" && body && "message" in body
            ? (body as { message: unknown }).message
            : error.message;
        return {
          outcome: "failed",
          message: Array.isArray(message)
            ? message.join("; ")
            : String(message),
        };
      }
      this.logger.error(error instanceof Error ? error.stack : String(error));
      return { outcome: "failed", message: "It could not be changed" };
    }
  }
}
