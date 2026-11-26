import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import type { Request } from "express";
import { ApiKeyModule } from "../api-key/api-key.module";
import { PreviewModule } from "../preview/preview.module";
import { ContentPreviewController } from "./content-preview.controller";
import { ContentPreviewService } from "./content-preview.service";
import { DELIVERY_RATE_WINDOW_MS } from "./delivery.constants";
import { DeliveryController } from "./delivery.controller";
import { DeliveryService } from "./delivery.service";
import { LiveContentService } from "./live-content.service";

@Module({
  imports: [
    ApiKeyModule,
    // Resolving Preview links; it also brings the admin route that issues them
    PreviewModule,
    // In memory, which is exact while cms-api runs as one instance
    ThrottlerModule.forRoot([
      {
        ttl: DELIVERY_RATE_WINDOW_MS,
        limit: (context) =>
          context.switchToHttp().getRequest<Request>().apiKey
            ?.rateLimitPerMinute ?? 0,
        getTracker: (request) => String((request as Request).apiKey?.id),
        // One bucket per key across every Content API route — the default gives each route its own
        generateKey: (_context, tracker, throttler) =>
          `${throttler}-${tracker}`,
      },
    ]),
  ],
  // ContentPreviewController is the admin's preview page: the Content API's code, behind Access
  controllers: [DeliveryController, ContentPreviewController],
  providers: [DeliveryService, LiveContentService, ContentPreviewService],
})
export class DeliveryModule {}
