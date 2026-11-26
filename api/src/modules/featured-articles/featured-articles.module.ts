import { Module } from "@nestjs/common";
import { FeaturedArticlesController } from "./featured-articles.controller";
import { FeaturedArticlesService } from "./featured-articles.service";

@Module({
  controllers: [FeaturedArticlesController],
  providers: [FeaturedArticlesService],
  exports: [FeaturedArticlesService],
})
export class FeaturedArticlesModule {}
