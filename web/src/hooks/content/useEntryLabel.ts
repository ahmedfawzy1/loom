import type { RichTextEntryType } from "@loom/dto/constants";
import type {
  Author,
  Blog,
  Category,
  SiteLanguage,
  Tag,
} from "@loom/dto/models";
import { useAuthor } from "@loom-web/src/hooks/content/useAuthors";
import { useBlog } from "@loom-web/src/hooks/content/useBlogs";
import { useCategory } from "@loom-web/src/hooks/content/useCategories";
import { useTag } from "@loom-web/src/hooks/content/useTags";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useContextStore } from "@loom-web/src/stores/context";

const TYPE_LABELS: Record<RichTextEntryType, string> = {
  blog: "Post",
  category: "Category",
  tag: "Tag",
  author: "Author",
};

/**
 * A readable name for an entry a body points at, in the language being edited — falling back to any
 * language, since a reference is still the same record when the target is untranslated.
 *
 * All four queries are declared every render because hooks cannot be conditional; only the one
 * matching `type` is enabled, so the others issue no request.
 */
export function useEntryLabel(
  type: RichTextEntryType,
  id: Blog["id"] | Category["id"] | Tag["id"] | Author["id"] | undefined,
) {
  const language = useContextStore((state) => state.languageCode);
  const { site } = useActiveSite();

  const blog = useBlog(type === "blog" ? id : undefined);
  const category = useCategory(type === "category" ? id : undefined);
  const tag = useTag(type === "tag" ? id : undefined);
  const author = useAuthor(type === "author" ? id : undefined);

  const pickLocale = <T extends { languageCode: SiteLanguage["code"] }>(
    locales: T[] | undefined,
  ) =>
    locales?.find((locale) => locale.languageCode === language) ??
    locales?.find((locale) => locale.languageCode === site?.defaultLanguage) ??
    locales?.[0];

  const query = { blog, category, tag, author }[type];

  const name = (() => {
    if (type === "blog") return pickLocale(blog.data?.locales)?.title;
    if (type === "category") return pickLocale(category.data?.locales)?.title;
    if (type === "tag") return pickLocale(tag.data?.locales)?.title;
    return author.data?.name;
  })();

  return {
    typeLabel: TYPE_LABELS[type],
    name,
    isPending: query.isPending && Boolean(id),
    // A 404 means the target is gone; see isNotFound for telling that apart from a failed load
    error: query.error,
  };
}
