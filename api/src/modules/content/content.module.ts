import { Global, Module } from "@nestjs/common";
import { ContentContextService } from "./content-context.service";
import { ContentQueryService } from "./content-query.service";
import { VersionService } from "./version.service";

/**
 * The shared content engine. Global because every content module needs it and threading it through
 * six imports adds nothing.
 */
@Global()
@Module({
  providers: [ContentQueryService, ContentContextService, VersionService],
  exports: [ContentQueryService, ContentContextService, VersionService],
})
export class ContentModule {}
