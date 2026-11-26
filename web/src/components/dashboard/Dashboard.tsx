"use client";

import { Button, cn, Skeleton } from "@heroui/react";
import type { DashboardResponseDto } from "@loom/dto";
import { CONTENT_TYPE_PATHS } from "@loom/dto/constants";
import { CmsContentType, CmsRole, LocaleStatus } from "@loom/dto/models";
import { ActivityEntry } from "@loom-web/src/components/activity/ActivityEntry";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { PageHeader } from "@loom-web/src/components/ui/PageHeader";
import { Section } from "@loom-web/src/components/ui/Section";
import { MISSING, statusLabel } from "@loom-web/src/components/ui/StatusChip";
import { ReviewQueue } from "@loom-web/src/components/workflow/ReviewQueue";
import { useDashboard } from "@loom-web/src/hooks/dashboard/useDashboard";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useCurrentUser } from "@loom-web/src/hooks/user/useCurrentUser";
import { useContextStore } from "@loom-web/src/stores/context";
import {
  Article,
  ClockCounterClockwise,
  FolderSimple,
  type Icon,
  Megaphone,
  Plus,
  Tag,
  UserCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// How many review items the dashboard lists before pointing at the Review page
const REVIEW_PREVIEW = 5;

// Left to right in the order an item moves through them; Missing last, as the one with no version
const COLUMNS: { status: LocaleStatus | typeof MISSING; dot: string }[] = [
  { status: LocaleStatus.PUBLISHED, dot: "bg-success" },
  { status: LocaleStatus.CHANGED, dot: "bg-warning" },
  { status: LocaleStatus.IN_REVIEW, dot: "bg-review" },
  { status: LocaleStatus.DRAFT, dot: "bg-muted/60" },
  { status: LocaleStatus.UNPUBLISHED, dot: "bg-muted/30" },
  { status: MISSING, dot: "border border-muted/60" },
];

const TYPE_ROWS: { type: CmsContentType; label: string; icon: Icon }[] = [
  { type: CmsContentType.BLOG, label: "Posts", icon: Article },
  { type: CmsContentType.CATEGORY, label: "Categories", icon: FolderSimple },
  { type: CmsContentType.TAG, label: "Tags", icon: Tag },
  { type: CmsContentType.AUTHOR, label: "Authors", icon: UserCircle },
  { type: CmsContentType.CTA, label: "CTAs", icon: Megaphone },
];

type DashboardData = Serialized<DashboardResponseDto>;

/**
 * Every type by its status in the language worked in: what is live, what waits, what is missing.
 * A count opens that list already filtered to it, and each row ends in its live share.
 */
function ContentByStatus({ data }: { data: DashboardData }) {
  const countOf = (
    type: CmsContentType,
    status: LocaleStatus | typeof MISSING,
  ) =>
    (status === MISSING
      ? data.missing.find((count) => count.type === type)?.count
      : data.statusCounts.find(
          (count) => count.type === type && count.status === status,
        )?.count) ?? 0;
  const totalOf = (type: CmsContentType) =>
    COLUMNS.reduce((sum, column) => sum + countOf(type, column.status), 0);

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted text-xs">
          <tr className="border-border border-b">
            <th className="px-5 pb-2 text-start font-medium">Content</th>
            {COLUMNS.map((column) => (
              <th
                className="px-3 pb-2 text-end font-medium"
                key={column.status}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("size-1.5 rounded-full", column.dot)} />
                  {statusLabel(column.status)}
                </span>
              </th>
            ))}
            <th className="w-40 px-5 pb-2 text-start font-medium">Live</th>
          </tr>
        </thead>
        <tbody>
          {TYPE_ROWS.map((row) => {
            const total = totalOf(row.type);
            const live = countOf(row.type, LocaleStatus.PUBLISHED);
            const RowIcon = row.icon;
            return (
              <tr
                className="border-separator border-b last:border-b-0"
                key={row.type}
              >
                <td className="px-5 py-2.5">
                  <Link
                    className="flex items-center gap-2 font-medium hover:text-accent"
                    href={`/${CONTENT_TYPE_PATHS[row.type]}`}
                  >
                    <RowIcon className="size-4 text-muted" />
                    {row.label}
                    <span className="font-normal text-muted text-xs tabular-nums">
                      {total}
                    </span>
                  </Link>
                </td>
                {COLUMNS.map((column) => {
                  const count = countOf(row.type, column.status);
                  return (
                    <td
                      className="px-3 py-2.5 text-end tabular-nums"
                      key={column.status}
                    >
                      {count === 0 ? (
                        <span className="text-muted/50">·</span>
                      ) : column.status === MISSING ? (
                        count
                      ) : (
                        <Link
                          className="rounded px-1 font-medium hover:bg-accent-soft hover:text-accent-soft-foreground"
                          href={`/${CONTENT_TYPE_PATHS[row.type]}?status=${column.status}`}
                        >
                          {count}
                        </Link>
                      )}
                    </td>
                  );
                })}
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-tertiary">
                      <div
                        className="h-full rounded-full bg-success"
                        style={{
                          width: `${total ? (live / total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="w-9 text-end text-muted text-xs tabular-nums">
                      {total ? Math.round((live / total) * 100) : 0}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <Skeleton className="h-28 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * The CMS home: where the Space stands in the language being worked in, what waits for
 * review, what changed lately, and what each other language still lacks.
 */
export function Dashboard() {
  const router = useRouter();
  const spaceId = useContextStore((state) => state.spaceId);
  const language = useContextStore((state) => state.languageCode);
  const setLanguage = useContextStore((state) => state.setLanguage);
  const { site } = useActiveSite();
  const { data: user } = useCurrentUser();
  const { data, isPending, error } = useDashboard({
    spaceId: spaceId ?? "",
    language,
  });
  const isReviewer =
    user?.role === CmsRole.ADMIN || user?.role === CmsRole.AUTHOR;
  const space = site?.spaces.find((candidate) => candidate.id === spaceId);
  const current = site?.languages.find(
    (candidate) => candidate.code === language,
  );

  const header = (
    <PageHeader
      actions={
        <Button onPress={() => router.push("/blogs/new")}>
          <Plus className="size-4" weight="bold" />
          New post
        </Button>
      }
      description={
        space &&
        `${space.name}, working in ${current?.label ?? language}. Everything below counts posts, categories, tags, authors and CTAs.`
      }
      title="Dashboard"
    />
  );

  if (error)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorText message={error.message} />
      </div>
    );
  if (!spaceId || isPending)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <DashboardSkeleton />
      </div>
    );

  // Every item of the Space, whatever its state in this language
  const total =
    data.statusCounts.reduce((sum, count) => sum + count.count, 0) +
    data.missing.reduce((sum, count) => sum + count.count, 0);

  return (
    <div className="flex flex-col gap-6">
      {header}

      <Section
        bodyClassName="pt-3 pb-1"
        title={`Content in ${current?.label ?? language}`}
      >
        <ContentByStatus data={data} />
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <Section
            actions={
              isReviewer && (
                <Link
                  className="text-accent text-sm hover:underline"
                  href="/review"
                >
                  View all
                </Link>
              )
            }
            bodyClassName="pt-1 pb-2"
            title={isReviewer ? "Waiting for review" : "Your submissions"}
          >
            <ReviewQueue limit={REVIEW_PREVIEW} />
          </Section>

          <Section
            actions={
              <Link
                className="text-accent text-sm hover:underline"
                href="/activity"
              >
                All activity
              </Link>
            }
            bodyClassName="pt-1 pb-2"
            title="Recent edits"
          >
            {data.recentEdits.length === 0 ? (
              <EmptyState icon={ClockCounterClockwise} title="No edits yet">
                Changes to content in this Space show up here.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-separator">
                {data.recentEdits.map((entry) => (
                  <ActivityEntry
                    entry={entry}
                    key={entry.id}
                    showSpace={false}
                  />
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section
          bodyClassName="gap-0 pt-2"
          description="How much of the Space each language has. Pick one to work in it."
          title="Languages"
        >
          {data.translations.length === 0 ? (
            <p className="text-muted text-sm">
              This Site has only its default language.
            </p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {data.translations.map((gap) => {
                const has = total ? (total - gap.missing) / total : 0;
                const info = site?.languages.find(
                  (candidate) => candidate.code === gap.languageCode,
                );
                return (
                  <li key={gap.languageCode}>
                    <button
                      className={cn(
                        "grid w-full grid-cols-[2.5rem_1fr_9rem] items-center gap-3 rounded-md px-2 py-1.5 text-start transition-colors duration-fast hover:bg-surface-secondary",
                        gap.languageCode === language && "bg-accent-soft",
                      )}
                      onClick={() => setLanguage(gap.languageCode)}
                      title={`${info?.label ?? gap.languageCode}: ${gap.missing} missing, ${gap.stale} stale, ${gap.untracked} untracked`}
                      type="button"
                    >
                      <span className="font-mono text-xs">
                        {gap.languageCode}
                      </span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-surface-tertiary">
                        <span
                          className="block h-full rounded-full bg-accent/70"
                          style={{ width: `${has * 100}%` }}
                        />
                      </span>
                      <span className="flex justify-end gap-2 whitespace-nowrap text-xs tabular-nums">
                        {gap.stale > 0 && (
                          <span className="text-warning-soft-foreground">
                            {gap.stale} stale
                          </span>
                        )}
                        <span className="text-muted">
                          {gap.missing ? `${gap.missing} missing` : "Complete"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 border-separator border-t pt-3 text-muted text-xs">
            DeepL this month:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {data.deeplUsage.characters.toLocaleString()}
            </span>{" "}
            characters
          </p>
        </Section>
      </div>
    </div>
  );
}
