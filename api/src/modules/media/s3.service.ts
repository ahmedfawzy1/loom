import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import type { Media, PendingUpload } from "@loom/database";
import type { MediaUploadResponseDto } from "@loom/dto";
import { MEDIA_MAX_UPLOAD_BYTES } from "@loom/dto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UPLOAD_URL_TTL_SECONDS } from "./media.constants";

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(configService: ConfigService) {
    const endpoint = configService.get<string>("S3_ENDPOINT");

    this.bucket = configService.getOrThrow<string>("S3_BUCKET");
    this.publicUrl = configService
      .getOrThrow<string>("S3_PUBLIC_URL")
      .replace(/\/$/, "");

    this.client = new S3Client({
      region: configService.getOrThrow<string>("S3_REGION"),
      credentials: {
        accessKeyId: configService.getOrThrow<string>("AWS_ACCESS_KEY_ID"),
        secretAccessKey: configService.getOrThrow<string>(
          "AWS_SECRET_ACCESS_KEY",
        ),
      },
      // Set only locally, for MinIO, which addresses buckets by path rather than subdomain
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
  }

  /**
   * A signed POST policy the browser uploads through directly, so image bytes never pass through
   * the API. Unlike a presigned PUT, a policy can bind what is sent and not just where: storage
   * refuses a different key, a different Content-Type, or a body over the size limit.
   */
  async createUploadPost(
    key: PendingUpload["key"],
    contentType: PendingUpload["mimeType"],
  ): Promise<Omit<MediaUploadResponseDto, "key">> {
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      // Every field is also signed as an exact-match condition, which is what pins the type
      Fields: { "Content-Type": contentType },
      Conditions: [["content-length-range", 1, MEDIA_MAX_UPLOAD_BYTES]],
      Expires: UPLOAD_URL_TTL_SECONDS,
    });
    return { url, fields };
  }

  async sizeOf(key: PendingUpload["key"]): Promise<Media["sizeBytes"]> {
    const result = await this.client
      .send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      .catch(() => {
        throw new NotFoundException(
          "Nothing was uploaded — the upload may have failed or expired",
        );
      });
    return result.ContentLength ?? 0;
  }

  /** The whole object. Bounded by the POST policy's size limit, so it is never more than that. */
  async read(key: PendingUpload["key"]): Promise<Uint8Array> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!result.Body) throw new NotFoundException(`Object ${key} has no body`);
    return result.Body.transformToByteArray();
  }

  /**
   * Copies a verified upload to where it is served. The Content-Type is replaced with the one the
   * API detected from the bytes, so what the bucket serves never comes from the browser.
   */
  async publish(
    from: PendingUpload["key"],
    to: Media["s3Key"],
    contentType: Media["mimeType"],
  ): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${from.split("/").map(encodeURIComponent).join("/")}`,
        Key: to,
        MetadataDirective: "REPLACE",
        ContentType: contentType,
        // Keys are unique per upload and Replace writes a new one, so an object never changes
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  async delete(key: PendingUpload["key"] | Media["s3Key"]): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  publicUrlOf(key: Media["s3Key"]): string {
    return `${this.publicUrl}/${key}`;
  }
}
