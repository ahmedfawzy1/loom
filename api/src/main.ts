import type { Server } from "node:http";
import { ClassSerializerInterceptor, ValidationPipe } from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import "reflect-metadata";
import { AppModule } from "./app.module";
import {
  DEFAULT_PORT,
  REQUEST_BODY_LIMIT,
  SERVER_HEADERS_TIMEOUT_MS,
  SERVER_KEEP_ALIVE_TIMEOUT_MS,
} from "./constants/server.constants";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // The admin app's rewrite sits in front, so the client IP arrives forwarded — when a load
  // balancer or CDN ahead of the admin app reports it. Sign-in limits count per client IP only then.
  app.set("trust proxy", 1);

  // No CORS configuration on purpose: the admin app reaches /admin/* through a Next rewrite, so
  // same-origin, and the websites call the Content API server-side. Neither is a cross-origin
  // browser request, and enabling cors in order to deny everything would just be a no-op.

  // Express's default is 100 KB, and Tiptap JSON is verbose: an ordinary ~6,800-word post, or a
  // value table of ~190 rows, crosses it. Set just above the rich-text cap so that cap — which
  // explains itself — is what a large body hits first.
  app.useBodyParser("json", { limit: REQUEST_BODY_LIMIT });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Registered after APP_INTERCEPTOR, which puts ResponseInterceptor outermost — so the serializer
  // runs on the payload and the envelope wraps the result. Swapping the two would hand
  // ClassSerializerInterceptor the { success, data } wrapper instead, and every response would
  // serialise to {}.
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector), {
      excludeExtraneousValues: true,
    }),
  );

  const server: Server = app.getHttpServer();
  server.keepAliveTimeout = SERVER_KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = SERVER_HEADERS_TIMEOUT_MS;

  await app.listen(process.env.PORT || DEFAULT_PORT);
}
bootstrap();
