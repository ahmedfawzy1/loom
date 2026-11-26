import type { Media } from "@loom/database";
import {
  IMAGE_FIELD_LABELS,
  IMAGE_FIELD_RULES,
  type ImageField,
  imageViolation,
} from "@loom/dto/constants";
import { BadRequestException } from "@nestjs/common";

export function assertImageFits(
  image: Pick<Media, "width" | "height" | "filename">,
  field: ImageField,
) {
  const violation = imageViolation(image, IMAGE_FIELD_RULES[field]);
  if (violation)
    throw new BadRequestException(
      `${IMAGE_FIELD_LABELS[field]} ${violation} (${image.filename}).`,
    );
}
