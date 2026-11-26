import { Module } from "@nestjs/common";
import { AuthorModule } from "../author/author.module";
import { BlogModule } from "../blog/blog.module";
import { CategoryModule } from "../category/category.module";
import { CtaModule } from "../cta/cta.module";
import { FeaturedArticlesModule } from "../featured-articles/featured-articles.module";
import { RevalidateModule } from "../revalidate/revalidate.module";
import { TagModule } from "../tag/tag.module";
import { BulkService } from "./bulk.service";
import { PublishService } from "./publish.service";
import { ReviewService } from "./review.service";
import { TrashService } from "./trash.service";
import { WorkflowController } from "./workflow.controller";

@Module({
  imports: [
    BlogModule,
    CategoryModule,
    TagModule,
    AuthorModule,
    CtaModule,
    FeaturedArticlesModule,
    RevalidateModule,
  ],
  controllers: [WorkflowController],
  providers: [PublishService, TrashService, ReviewService, BulkService],
  exports: [PublishService, ReviewService],
})
export class WorkflowModule {}
