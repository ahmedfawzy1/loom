import { Module } from "@nestjs/common";
import { ActivityModule } from "../activity/activity.module";
import { AuthorModule } from "../author/author.module";
import { BlogModule } from "../blog/blog.module";
import { CategoryModule } from "../category/category.module";
import { CtaModule } from "../cta/cta.module";
import { FeaturedArticlesModule } from "../featured-articles/featured-articles.module";
import { McpTokenModule } from "../mcp-token/mcp-token.module";
import { MediaModule } from "../media/media.module";
import { SearchModule } from "../search/search.module";
import { SiteModule } from "../site/site.module";
import { TagModule } from "../tag/tag.module";
import { WorkflowModule } from "../workflow/workflow.module";
import { McpController } from "./mcp.controller";
import { McpAuthService } from "./mcp-auth.service";
import { McpServerFactory } from "./mcp-server.factory";

@Module({
  imports: [
    McpTokenModule,
    SiteModule,
    BlogModule,
    CategoryModule,
    TagModule,
    AuthorModule,
    CtaModule,
    FeaturedArticlesModule,
    MediaModule,
    SearchModule,
    ActivityModule,
    WorkflowModule,
  ],
  controllers: [McpController],
  providers: [McpAuthService, McpServerFactory],
})
export class McpModule {}
