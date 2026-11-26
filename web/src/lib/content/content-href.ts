import { CONTENT_TYPE_PATHS } from "@loom/dto/constants";
import { CmsContentType } from "@loom/dto/models";

/** Where an item is edited. Featured Articles is one page per Space, not one per id. */
export const contentHref = (type: CmsContentType, id: string) =>
  type === CmsContentType.FEATURED_ARTICLES
    ? `/${CONTENT_TYPE_PATHS[type]}`
    : `/${CONTENT_TYPE_PATHS[type]}/${id}`;
