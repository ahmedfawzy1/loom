import { Global, Module } from "@nestjs/common";
import { RevalidateModule } from "../revalidate/revalidate.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { S3Service } from "./s3.service";

/** Global because every content type with an image field checks attachments through it. */
@Global()
@Module({
  imports: [RevalidateModule],
  controllers: [MediaController],
  providers: [MediaService, S3Service],
  exports: [MediaService, S3Service],
})
export class MediaModule {}
