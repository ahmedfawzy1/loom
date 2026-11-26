import { Module } from "@nestjs/common";
import { ApiKeyModule } from "../api-key/api-key.module";
import { RevalidateModule } from "../revalidate/revalidate.module";
import { SiteController } from "./site.controller";
import { SiteService } from "./site.service";

@Module({
  imports: [RevalidateModule, ApiKeyModule],
  controllers: [SiteController],
  providers: [SiteService],
  exports: [SiteService],
})
export class SiteModule {}
