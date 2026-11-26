import { Module } from "@nestjs/common";
import { PreviewController } from "./preview.controller";
import { PreviewService } from "./preview.service";

/** Draft preview links. The Content API side — resolving them — lives in the delivery module. */
@Module({
  controllers: [PreviewController],
  providers: [PreviewService],
  exports: [PreviewService],
})
export class PreviewModule {}
