import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { validateEnv } from "./config/env.validation";
import { ActivityModule } from "./modules/activity/activity.module";
import { ApiKeyModule } from "./modules/api-key/api-key.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { RoleGuard } from "./modules/auth/role.guard";
import { SessionGuard } from "./modules/auth/session.guard";
import { AuthorModule } from "./modules/author/author.module";
import { BlogModule } from "./modules/blog/blog.module";
import { CategoryModule } from "./modules/category/category.module";
import { ContentModule } from "./modules/content/content.module";
import { CtaModule } from "./modules/cta/cta.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { DeliveryModule } from "./modules/delivery/delivery.module";
import { FeaturedArticlesModule } from "./modules/featured-articles/featured-articles.module";
import { HealthModule } from "./modules/health/health.module";
import { McpModule } from "./modules/mcp/mcp.module";
import { McpTokenModule } from "./modules/mcp-token/mcp-token.module";
import { MediaModule } from "./modules/media/media.module";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { RevalidateModule } from "./modules/revalidate/revalidate.module";
import { SearchModule } from "./modules/search/search.module";
import { SiteModule } from "./modules/site/site.module";
import { SpaceModule } from "./modules/space/space.module";
import { TagModule } from "./modules/tag/tag.module";
import { TranslationModule } from "./modules/translation/translation.module";
import { UserModule } from "./modules/user/user.module";
import { WorkflowModule } from "./modules/workflow/workflow.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuditModule,
    AuthModule,
    ContentModule,
    MediaModule,
    CategoryModule,
    TagModule,
    AuthorModule,
    CtaModule,
    BlogModule,
    FeaturedArticlesModule,
    WorkflowModule,
    TranslationModule,
    UserModule,
    SiteModule,
    SpaceModule,
    ApiKeyModule,
    RevalidateModule,
    DeliveryModule,
    SearchModule,
    ActivityModule,
    DashboardModule,
    HealthModule,
    McpTokenModule,
    McpModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // Order matters: SessionGuard attaches request.cmsUser that RoleGuard then reads
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
  ],
})
export class AppModule {}
