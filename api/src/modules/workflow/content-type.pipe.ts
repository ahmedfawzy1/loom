import type { CmsContentType } from "@loom/database";
import { CONTENT_TYPE_PATHS } from "@loom/dto/constants";
import {
  Injectable,
  NotFoundException,
  type PipeTransform,
} from "@nestjs/common";

const TYPE_BY_PATH = new Map(
  (Object.entries(CONTENT_TYPE_PATHS) as [CmsContentType, string][]).map(
    ([type, path]) => [path, type],
  ),
);

/** Turns the `:type` route segment — `blogs`, `categories`, … — into the content type it names. */
@Injectable()
export class ContentTypePipe implements PipeTransform<string, CmsContentType> {
  transform(value: string): CmsContentType {
    const type = TYPE_BY_PATH.get(value);
    if (!type)
      throw new NotFoundException(`There is no content type "${value}"`);
    return type;
  }
}
