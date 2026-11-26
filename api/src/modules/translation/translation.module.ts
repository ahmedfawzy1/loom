import { Module } from "@nestjs/common";
import { AuthorModule } from "../author/author.module";
import { BlogModule } from "../blog/blog.module";
import { CategoryModule } from "../category/category.module";
import { CtaModule } from "../cta/cta.module";
import { TagModule } from "../tag/tag.module";
import { DeeplService } from "./deepl.service";
import { TranslationController } from "./translation.controller";
import { TranslationService } from "./translation.service";

@Module({
  imports: [BlogModule, CategoryModule, TagModule, AuthorModule, CtaModule],
  controllers: [TranslationController],
  providers: [DeeplService, TranslationService],
  exports: [TranslationService],
})
export class TranslationModule {}
