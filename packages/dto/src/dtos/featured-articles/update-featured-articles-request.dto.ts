import type { Blog } from "@loom/database";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from "class-validator";
import {
  FEATURED_ARTICLES_MAX,
  FEATURED_ARTICLES_MIN,
} from "../../constants/validation.constants";

/** The carousel list for one language — ordered, with position taken from the array index. */
export class UpdateFeaturedArticlesRequestDto {
  @IsArray()
  @ArrayMinSize(FEATURED_ARTICLES_MIN)
  @ArrayMaxSize(FEATURED_ARTICLES_MAX)
  @IsString({ each: true })
  blogIds: Blog["id"][];
}
