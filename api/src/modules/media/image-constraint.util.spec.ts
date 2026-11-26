import { IMAGE_FIELD_RULES, imageViolation } from "@loom/dto/constants";
import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { assertImageFits } from "./image-constraint.util";

const image = (width: number, height: number) => ({
  width,
  height,
  filename: "x.png",
});

describe("imageViolation — plan §12 and §13", () => {
  it("accepts a landscape image where landscape is required", () => {
    expect(
      imageViolation(
        image(1600, 900),
        IMAGE_FIELD_RULES["category.featuredImage"],
      ),
    ).toBeNull();
  });

  it("rejects portrait where landscape is required", () => {
    expect(
      imageViolation(
        image(600, 900),
        IMAGE_FIELD_RULES["category.featuredImage"],
      ),
    ).toMatch(/landscape/);
  });

  // Square is neither wider nor taller, so it is not landscape
  it("rejects square where landscape is required", () => {
    expect(
      imageViolation(
        image(800, 800),
        IMAGE_FIELD_RULES["category.featuredImage"],
      ),
    ).toMatch(/landscape/);
  });

  it("accepts an exactly square icon", () => {
    expect(
      imageViolation(
        image(512, 512),
        IMAGE_FIELD_RULES["category.featureIcon"],
      ),
    ).toBeNull();
  });

  it("rejects an icon that is one pixel off square", () => {
    expect(
      imageViolation(
        image(512, 511),
        IMAGE_FIELD_RULES["category.featureIcon"],
      ),
    ).toMatch(/square/);
  });

  it("enforces the tag image minimum on both axes", () => {
    const rule = IMAGE_FIELD_RULES["tag.featuredImage"];
    expect(imageViolation(image(1200, 630), rule)).toBeNull();
    expect(imageViolation(image(1199, 630), rule)).toMatch(/at least 1200×630/);
    expect(imageViolation(image(1200, 629), rule)).toMatch(/at least 1200×630/);
  });

  it("checks shape before size, so a small portrait tag image reports the shape", () => {
    expect(
      imageViolation(image(600, 900), IMAGE_FIELD_RULES["tag.featuredImage"]),
    ).toMatch(/landscape/);
  });

  it("accepts anything in an unconstrained field", () => {
    for (const field of [
      "blog.image",
      "author.profileImage",
      "cta.image",
      "category.gameCover",
    ] as const)
      expect(
        imageViolation(image(10, 900), IMAGE_FIELD_RULES[field]),
      ).toBeNull();
  });
});

describe("assertImageFits", () => {
  it("throws a 400 that names the field, the dimensions and the file", () => {
    expect(() =>
      assertImageFits(image(600, 900), "category.featuredImage"),
    ).toThrow(BadRequestException);
    expect(() =>
      assertImageFits(image(600, 900), "category.featuredImage"),
    ).toThrow(/featured image.*600×900.*x\.png/);
  });
});
