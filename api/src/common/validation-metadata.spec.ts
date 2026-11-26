import "reflect-metadata";
import { MODULE_METADATA, ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { RouteParamtypes } from "@nestjs/common/enums/route-paramtypes.enum";
import { getMetadataStorage } from "class-validator";
import { describe, expect, it } from "vitest";
import { AppModule } from "../app.module";

type Ctor = new (...args: never[]) => unknown;

/** Every controller reachable from AppModule, so a new module is covered without editing this file. */
function discoverControllers(
  module: unknown,
  seen = new Set<unknown>(),
): Ctor[] {
  if (!module || seen.has(module)) return [];
  seen.add(module);

  // A DynamicModule is a plain object carrying the class under `module`
  const target =
    typeof module === "object" && module !== null && "module" in module
      ? (module as { module: unknown }).module
      : module;
  if (typeof target !== "function") return [];

  const controllers: Ctor[] =
    Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, target) ?? [];
  const imports: unknown[] =
    Reflect.getMetadata(MODULE_METADATA.IMPORTS, target) ?? [];

  return [
    ...controllers,
    ...imports.flatMap((imported) => discoverControllers(imported, seen)),
  ];
}

interface Payload {
  controller: string;
  handler: string;
  source: "body" | "query";
  type: unknown;
  typeName: string;
}

/** Every request payload the API validates, discovered rather than listed. */
function discoverPayloads(): Payload[] {
  const payloads: Payload[] = [];

  for (const controller of discoverControllers(AppModule)) {
    const handlers = Object.getOwnPropertyNames(controller.prototype).filter(
      (name) => name !== "constructor",
    );

    for (const handler of handlers) {
      const routeArgs: Record<string, { index: number }> =
        Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, handler) ?? {};
      const paramtypes: unknown[] =
        Reflect.getMetadata(
          "design:paramtypes",
          controller.prototype,
          handler,
        ) ?? [];

      for (const [key, meta] of Object.entries(routeArgs)) {
        const paramtype = Number(key.split(":")[0]);
        const source =
          paramtype === RouteParamtypes.BODY
            ? "body"
            : paramtype === RouteParamtypes.QUERY
              ? "query"
              : undefined;
        if (!source) continue;

        const type = paramtypes[meta.index];
        payloads.push({
          controller: controller.name,
          handler,
          source,
          type,
          typeName: typeof type === "function" ? type.name : String(type),
        });
      }
    }
  }

  return payloads.sort((a, b) =>
    `${a.controller}.${a.handler}.${a.source}`.localeCompare(
      `${b.controller}.${b.handler}.${b.source}`,
    ),
  );
}

const PAYLOADS = discoverPayloads();

/**
 * A DTO imported with `import type` is erased at compile time, so emitDecoratorMetadata records a
 * placeholder for that parameter and ValidationPipe skips it — every request payload then reaches
 * the service unvalidated. It typechecks and it builds, so nothing else catches it. Biome's
 * useImportType rule makes exactly that edit, which is why each Nest workspace disables it.
 *
 * The assertion is "this type has class-validator metadata" rather than "this type is not Object",
 * because the placeholder is compiler-dependent: tsc (which builds what ships) emits `Function`
 * while swc (which builds this test) emits `Object`, so an identity check against `Object` passes
 * against the real artifact. Validator metadata is absent for both placeholders and present for a
 * real DTO, so it holds whichever compiler ran. It also catches a correctly-typed DTO that carries
 * no validators at all — `whitelist: true` strips that to `{}`, which is a worse silent failure
 * than the erasure.
 *
 * Keyed params (`@Body("name") name: string`) fail this deliberately: the convention is one DTO per
 * payload, so `String` having no validator metadata is the rule working, not a false positive.
 */
describe("every request payload validates", () => {
  for (const payload of PAYLOADS) {
    it(`${payload.controller}.${payload.handler} (${payload.source})`, () => {
      const metadata = getMetadataStorage().getTargetValidationMetadatas(
        payload.type as Ctor,
        payload.typeName,
        false,
        false,
      );
      expect(metadata.length).toBeGreaterThan(0);
    });
  }
});

/**
 * Pins the discovered surface so removing a `@Body()`/`@Query()` fails loudly instead of silently
 * contributing zero assertions above, and adding one forces a conscious update.
 */
describe("the validated surface is the expected one", () => {
  it("matches the recorded inventory", () => {
    expect(
      PAYLOADS.map(
        (payload) =>
          `${payload.controller}.${payload.handler} (${payload.source}) -> ${payload.typeName}`,
      ),
    ).toMatchInlineSnapshot(`
      [
        "ActivityController.list (query) -> ListActivityRequestDto",
        "ApiKeyController.createApiKey (body) -> CreateApiKeyRequestDto",
        "AuthController.changePassword (body) -> ChangePasswordRequestDto",
        "AuthController.login (body) -> LoginRequestDto",
        "AuthController.passwordLink (body) -> PasswordLinkTokenRequestDto",
        "AuthController.setPassword (body) -> SetPasswordRequestDto",
        "AuthorController.create (body) -> CreateAuthorRequestDto",
        "AuthorController.list (query) -> ListContentRequestDto",
        "AuthorController.update (body) -> UpdateAuthorRequestDto",
        "AuthorController.updateLocale (body) -> UpdateAuthorLocaleRequestDto",
        "BlogController.create (body) -> CreateBlogRequestDto",
        "BlogController.list (query) -> ListContentRequestDto",
        "BlogController.update (body) -> UpdateBlogRequestDto",
        "BlogController.updateLocale (body) -> UpdateBlogLocaleRequestDto",
        "CategoryController.create (body) -> CreateCategoryRequestDto",
        "CategoryController.list (query) -> ListContentRequestDto",
        "CategoryController.update (body) -> UpdateCategoryRequestDto",
        "CategoryController.updateLocale (body) -> UpdateCategoryLocaleRequestDto",
        "CtaController.create (body) -> CreateCtaRequestDto",
        "CtaController.list (query) -> ListContentRequestDto",
        "CtaController.update (body) -> UpdateCtaRequestDto",
        "CtaController.updateLocale (body) -> UpdateCtaLocaleRequestDto",
        "DashboardController.get (query) -> DashboardRequestDto",
        "DeliveryController.getAuthor (query) -> DeliveryLocaleRequestDto",
        "DeliveryController.getBlog (query) -> DeliveryLocaleRequestDto",
        "DeliveryController.getCategory (query) -> DeliveryLocaleRequestDto",
        "DeliveryController.getFeaturedArticles (query) -> DeliveryLocaleRequestDto",
        "DeliveryController.getTag (query) -> DeliveryLocaleRequestDto",
        "DeliveryController.listAuthors (query) -> DeliveryLocaleRequestDto",
        "DeliveryController.listBlogs (query) -> DeliveryBlogListRequestDto",
        "DeliveryController.listCategories (query) -> DeliveryLocaleRequestDto",
        "DeliveryController.listTags (query) -> DeliveryLocaleRequestDto",
        "DeliveryController.resolvePreview (query) -> DeliveryPreviewRequestDto",
        "FeaturedArticlesController.updateLocale (body) -> UpdateFeaturedArticlesRequestDto",
        "McpTokenController.create (body) -> CreateMcpTokenRequestDto",
        "MediaController.confirm (body) -> ConfirmMediaRequestDto",
        "MediaController.createUpload (body) -> CreateMediaUploadRequestDto",
        "MediaController.list (query) -> ListMediaRequestDto",
        "MediaController.replace (body) -> ReplaceMediaRequestDto",
        "MediaController.update (body) -> UpdateMediaRequestDto",
        "RevalidateController.refreshLivePages (body) -> SpaceScopeRequestDto",
        "SearchController.search (query) -> SearchRequestDto",
        "SiteController.createSite (body) -> CreateSiteRequestDto",
        "SiteController.deleteSite (body) -> DeleteSiteRequestDto",
        "SiteController.updateLanguages (body) -> UpdateSiteLanguagesRequestDto",
        "SiteController.updateProtectedTerms (body) -> UpdateProtectedTermsRequestDto",
        "SiteController.updateSite (body) -> UpdateSiteRequestDto",
        "SpaceController.createSpace (body) -> CreateSpaceRequestDto",
        "SpaceController.deleteSpace (body) -> DeleteSpaceRequestDto",
        "SpaceController.renameSpace (body) -> UpdateSpaceRequestDto",
        "TagController.create (body) -> CreateTagRequestDto",
        "TagController.list (query) -> ListContentRequestDto",
        "TagController.update (body) -> UpdateTagRequestDto",
        "TagController.updateLocale (body) -> UpdateTagLocaleRequestDto",
        "TranslationController.translate (body) -> TranslateRequestDto",
        "UserController.invite (body) -> InviteUserRequestDto",
        "UserController.updateRole (body) -> UpdateUserRoleRequestDto",
        "UserController.updateStatus (body) -> UpdateUserStatusRequestDto",
        "WorkflowController.bulk (body) -> BulkRequestDto",
        "WorkflowController.requestChanges (body) -> RequestChangesRequestDto",
        "WorkflowController.reviewQueue (query) -> SpaceScopeRequestDto",
        "WorkflowController.trashList (query) -> SpaceScopeRequestDto",
      ]
    `);
  });
});
