import { randomUUID } from "node:crypto";
import {
  AuditAction,
  type Media,
  type PendingUpload,
  type Prisma,
} from "@loom/database";
import type {
  ConfirmMediaRequestDto,
  CreateMediaUploadRequestDto,
  ListMediaRequestDto,
  MediaUsageResponseDto,
  UpdateMediaRequestDto,
} from "@loom/dto";
import {
  listDefaults,
  MEDIA_ALLOWED_MIME_TYPES,
  MEDIA_MAX_UPLOAD_BYTES,
} from "@loom/dto";
import {
  IMAGE_FIELD_RULES,
  type ImageField,
  imageViolation,
} from "@loom/dto/constants";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import sharp from "sharp";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { blogBodiesContaining } from "../content/body-references.util";
import { PrismaService } from "../prisma/prisma.service";
import { RevalidateService } from "../revalidate/revalidate.service";
import { assertImageFits } from "./image-constraint.util";
import {
  MAX_INPUT_PIXELS,
  MEDIA_PREFIX,
  MIME_BY_SHARP_FORMAT,
  PENDING_PREFIX,
  PENDING_UPLOAD_CLAIM_SECONDS,
} from "./media.constants";
import { S3Service } from "./s3.service";

/** What the API measured about an uploaded object, as opposed to what the browser said about it. */
interface InspectedImage {
  mimeType: Media["mimeType"];
  width: Media["width"];
  height: Media["height"];
  sizeBytes: Media["sizeBytes"];
}

// Every canonical column that holds a Media id, with the rule its field carries
const IMAGE_COLUMNS: {
  field: ImageField;
  find: (
    prisma: PrismaService,
    mediaId: Media["id"],
  ) => Promise<
    {
      id: MediaUsageResponseDto["contentId"];
      label: MediaUsageResponseDto["label"];
    }[]
  >;
}[] = [
  {
    field: "blog.image",
    find: async (prisma, imageId) =>
      (
        await prisma.blog.findMany({
          where: { imageId },
          select: { id: true, locales: { select: { title: true }, take: 1 } },
        })
      ).map((row) => ({ id: row.id, label: row.locales[0]?.title ?? row.id })),
  },
  {
    field: "category.featuredImage",
    find: async (prisma, featuredImageId) =>
      (
        await prisma.category.findMany({
          where: { featuredImageId },
          select: { id: true, slug: true },
        })
      ).map((row) => ({ id: row.id, label: row.slug })),
  },
  {
    field: "category.featureIcon",
    find: async (prisma, featureIconId) =>
      (
        await prisma.category.findMany({
          where: { featureIconId },
          select: { id: true, slug: true },
        })
      ).map((row) => ({ id: row.id, label: row.slug })),
  },
  {
    field: "category.gameCover",
    find: async (prisma, gameCoverId) =>
      (
        await prisma.category.findMany({
          where: { gameCoverId },
          select: { id: true, slug: true },
        })
      ).map((row) => ({ id: row.id, label: row.slug })),
  },
  {
    field: "tag.featuredImage",
    find: async (prisma, featuredImageId) =>
      (
        await prisma.tag.findMany({
          where: { featuredImageId },
          select: { id: true, slug: true },
        })
      ).map((row) => ({ id: row.id, label: row.slug })),
  },
  {
    field: "author.profileImage",
    find: async (prisma, profileImageId) =>
      (
        await prisma.author.findMany({
          where: { profileImageId },
          select: { id: true, name: true },
        })
      ).map((row) => ({ id: row.id, label: row.name })),
  },
  {
    field: "cta.image",
    find: async (prisma, imageId) =>
      (
        await prisma.cta.findMany({
          where: { imageId },
          select: { id: true, url: true },
        })
      ).map((row) => ({ id: row.id, label: row.url })),
  },
];

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly auditService: AuditService,
    private readonly revalidate: RevalidateService,
  ) {}

  async createUpload(
    actor: AuthenticatedUser,
    args: CreateMediaUploadRequestDto,
  ) {
    // Rows outlive their objects (the bucket's lifecycle rule expires those), so they are swept here
    await this.prisma.pendingUpload.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    // A random prefix keeps two uploads of "banner.png" from overwriting each other in the bucket
    const key = `${PENDING_PREFIX}${randomUUID()}/${safeFilename(args.filename)}`;
    await this.prisma.pendingUpload.create({
      data: {
        key,
        mimeType: args.mimeType,
        uploadedById: actor.id,
        expiresAt: new Date(Date.now() + PENDING_UPLOAD_CLAIM_SECONDS * 1000),
      },
    });

    return { key, ...(await this.s3.createUploadPost(key, args.mimeType)) };
  }

  async confirm(actor: AuthenticatedUser, args: ConfirmMediaRequestDto) {
    const pending = await this.claim(actor, args.key);
    const image = await this.inspect(pending);
    const s3Key = await this.publish(pending, image.mimeType);

    const media = await this.prisma.media.create({
      data: {
        s3Key,
        filename: args.filename.trim(),
        altText: args.altText?.trim() ?? "",
        ...image,
        uploadedById: actor.id,
      },
    });

    await this.auditService.log(actor, {
      action: AuditAction.MEDIA_UPLOADED,
      contentId: media.id,
      metadata: {
        filename: media.filename,
        width: media.width,
        height: media.height,
      },
    });

    return this.toResponse(media);
  }

  async list(query: ListMediaRequestDto) {
    const page = query.page ?? listDefaults.page;
    const pageSize = query.pageSize ?? listDefaults.pageSize;

    // Deleted images are hidden here and nowhere else — see remove(). The Trash asks for them instead.
    const where: Prisma.MediaWhereInput = {
      deletedAt: query.deleted ? { not: null } : null,
      ...(query.q
        ? {
            OR: [
              { filename: { contains: query.q, mode: "insensitive" } },
              { altText: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.media.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toResponse(row)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async get(mediaId: Media["id"]) {
    return this.toResponse(await this.requireMedia(mediaId));
  }

  async update(
    actor: AuthenticatedUser,
    mediaId: Media["id"],
    args: UpdateMediaRequestDto,
  ) {
    await this.requireMedia(mediaId);

    const media = await this.prisma.media.update({
      where: { id: mediaId },
      data: {
        ...(args.filename !== undefined
          ? { filename: args.filename.trim() }
          : {}),
        ...(args.altText !== undefined ? { altText: args.altText.trim() } : {}),
      },
    });

    await this.auditService.log(actor, {
      action: AuditAction.MEDIA_EDITED,
      contentId: mediaId,
      metadata: { fields: Object.keys(args) },
    });
    // The website serves the alt text, not the filename
    if (args.altText !== undefined) this.revalidate.mediaChanged(mediaId);

    return this.toResponse(media);
  }

  /**
   * Swaps the file behind a Media row, keeping its id so every reference follows automatically.
   *
   * Every field currently using the image is re-checked against the new file first. Without that,
   * Replace is a way round the rules attachment enforces: swap a landscape banner for a portrait
   * photo and the category's featured image silently stops being landscape.
   */
  async replace(
    actor: AuthenticatedUser,
    mediaId: Media["id"],
    key: PendingUpload["key"],
  ) {
    const existing = await this.requireMedia(mediaId);
    const pending = await this.claim(actor, key);
    const image = await this.inspect(pending);

    const usages = await this.canonicalUsages(mediaId);
    const broken = usages.flatMap((usage) => {
      const violation = imageViolation(
        image,
        IMAGE_FIELD_RULES[usage.field as ImageField],
      );
      return violation ? [`${usage.label} (${usage.field}) ${violation}`] : [];
    });
    if (broken.length) {
      await this.s3.delete(pending.key);
      throw new BadRequestException(
        `The new file does not fit where this image is used: ${broken.join("; ")}`,
      );
    }

    const s3Key = await this.publish(pending, image.mimeType);
    const media = await this.prisma.media.update({
      where: { id: mediaId },
      data: { s3Key, ...image },
    });

    // The old object is kept. Keys are immutable and cached as such, and pages rendered before the
    // Replace still hold the old URL until they are next rebuilt — deleting it would break them.

    await this.auditService.log(actor, {
      action: AuditAction.MEDIA_REPLACED,
      contentId: mediaId,
      metadata: {
        from: existing.filename,
        width: image.width,
        height: image.height,
      },
    });
    this.revalidate.mediaChanged(mediaId);

    return this.toResponse(media);
  }

  /** Every place an image is used: canonical image fields, and embeds inside post bodies. */
  async usagesOf(mediaId: Media["id"]): Promise<MediaUsageResponseDto[]> {
    await this.requireMedia(mediaId);
    const [canonical, embedded] = await Promise.all([
      this.canonicalUsages(mediaId),
      this.embeddedUsages(mediaId),
    ]);
    return [...canonical, ...embedded];
  }

  /**
   * Hides an image from the library and pickers. Nothing else changes: the object stays in the
   * bucket and every id stays valid, so content still using it — including version snapshots,
   * which no usage scan sees — keeps rendering, and restoring it only means clearing the column.
   */
  async remove(actor: AuthenticatedUser, mediaId: Media["id"]) {
    const media = await this.requireMedia(mediaId);
    if (media.deletedAt) return;

    await this.prisma.media.update({
      where: { id: mediaId },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log(actor, {
      action: AuditAction.MEDIA_DELETED,
      contentId: mediaId,
      metadata: { filename: media.filename },
    });
  }

  async restore(actor: AuthenticatedUser, mediaId: Media["id"]) {
    const media = await this.requireMedia(mediaId);
    if (!media.deletedAt) return;

    await this.prisma.media.update({
      where: { id: mediaId },
      data: { deletedAt: null },
    });

    await this.auditService.log(actor, {
      action: AuditAction.MEDIA_RESTORED,
      contentId: mediaId,
      metadata: { filename: media.filename },
    });
  }

  /**
   * For content services attaching an image to a field. Throws when the image is missing or does
   * not satisfy that field's rule.
   */
  async requireImageFor(mediaId: Media["id"], field: ImageField) {
    const media = await this.requireMedia(mediaId);
    assertImageFits(media, field);
    return media;
  }

  /**
   * Checks every image a write is attaching. `null` clears a field and `undefined` leaves it
   * alone, so neither is checked — only an id is. Missing images are caught here too, because
   * letting the foreign key reject them surfaces as "something still references this record",
   * which describes the opposite problem.
   */
  async assertImagesFit(
    assignments: {
      mediaId: Media["id"] | null | undefined;
      field: ImageField;
    }[],
  ) {
    await Promise.all(
      assignments
        .filter(
          (
            assignment,
          ): assignment is { mediaId: Media["id"]; field: ImageField } =>
            typeof assignment.mediaId === "string",
        )
        .map((assignment) =>
          this.requireImageFor(assignment.mediaId, assignment.field),
        ),
    );
  }

  /**
   * Deleted images are found too. Content already using one re-sends its id on every save, so
   * refusing it here would make that content unsaveable until someone worked out which image it was.
   */
  private async requireMedia(mediaId: Media["id"]) {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });
    if (!media) throw new NotFoundException(`Image ${mediaId} not found`);
    return media;
  }

  /**
   * Takes a pending upload for this user, exactly once. The delete is the claim: of two concurrent
   * confirms of the same key only one deletes the row, so only one goes on to create an image.
   */
  private async claim(
    actor: AuthenticatedUser,
    key: PendingUpload["key"],
  ): Promise<PendingUpload> {
    const pending = await this.prisma.pendingUpload.findUnique({
      where: { key },
    });
    const { count } = await this.prisma.pendingUpload.deleteMany({
      where: { key, uploadedById: actor.id, expiresAt: { gt: new Date() } },
    });
    if (!pending || count !== 1)
      throw new NotFoundException(
        "That upload has expired or was already used — upload the file again",
      );
    return pending;
  }

  /**
   * Measures what actually landed. The browser declared a type when it asked to upload, but nothing
   * it said is trusted: the bytes decide, and the image is decoded rather than only header-read, so
   * a valid header on a truncated or corrupt body is refused too. A failure deletes the upload —
   * and only a pending upload can reach here, so that is never a live image.
   */
  private async inspect(pending: PendingUpload): Promise<InspectedImage> {
    const fail = async (reason: string): Promise<never> => {
      await this.s3.delete(pending.key);
      throw new BadRequestException(reason);
    };

    const sizeBytes = await this.s3.sizeOf(pending.key);
    // The POST policy already caps this; checked again so the limit does not rest on one control
    if (sizeBytes > MEDIA_MAX_UPLOAD_BYTES)
      return fail(
        `That file is ${Math.round(sizeBytes / 1024 / 1024)} MB — the limit is ${MEDIA_MAX_UPLOAD_BYTES / 1024 / 1024} MB`,
      );

    const bytes = await this.s3.read(pending.key);
    const image = sharp(bytes, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    });

    let metadata: sharp.Metadata;
    try {
      metadata = await image.metadata();
      await image.resize(32, 32, { fit: "inside" }).toBuffer();
    } catch {
      return fail("That file is not an image this library can read");
    }

    const mimeType =
      metadata.format === "heif"
        ? metadata.compression === "av1"
          ? "image/avif"
          : undefined
        : MIME_BY_SHARP_FORMAT[metadata.format];
    if (
      !mimeType ||
      !(MEDIA_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)
    )
      return fail(
        `${metadata.format} is not supported — use JPEG, PNG, WebP, GIF or AVIF`,
      );

    // The bytes are the authority, but a mismatch means something upstream misreported the file
    if (pending.mimeType !== mimeType)
      return fail(
        `The file was uploaded as ${pending.mimeType} but its contents are ${mimeType}`,
      );

    return {
      mimeType,
      // As displayed: a phone photo stored sideways with an EXIF rotation is as tall as it looks,
      // and an animation is one frame tall rather than every frame stacked
      width: metadata.autoOrient.width,
      height: metadata.pageHeight ?? metadata.autoOrient.height,
      sizeBytes,
    };
  }

  /** Copies a verified upload to where images are served, and drops the pending copy. */
  private async publish(
    pending: PendingUpload,
    mimeType: Media["mimeType"],
  ): Promise<Media["s3Key"]> {
    const s3Key = `${MEDIA_PREFIX}${pending.key.slice(PENDING_PREFIX.length)}`;
    await this.s3.publish(pending.key, s3Key, mimeType);
    await this.s3.delete(pending.key);
    return s3Key;
  }

  private async canonicalUsages(
    mediaId: Media["id"],
  ): Promise<MediaUsageResponseDto[]> {
    const found = await Promise.all(
      IMAGE_COLUMNS.map(async (column) =>
        (await column.find(this.prisma, mediaId)).map((row) => ({
          field: column.field,
          contentId: row.id,
          label: row.label,
        })),
      ),
    );
    return found.flat();
  }

  private async embeddedUsages(
    mediaId: Media["id"],
  ): Promise<MediaUsageResponseDto[]> {
    const bodies = await blogBodiesContaining(this.prisma, mediaId);
    return bodies.map((body) => ({
      field: "blog.body",
      contentId: body.blogId,
      label: `${body.title} (${body.languageCode})`,
    }));
  }

  private toResponse(media: Media) {
    return { ...media, url: this.s3.publicUrlOf(media.s3Key) };
  }
}

/** Keeps a filename readable in the bucket while removing anything that could escape the key. */
function safeFilename(filename: string): string {
  const cleaned = filename
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  return cleaned || "image";
}
