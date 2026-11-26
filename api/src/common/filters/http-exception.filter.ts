import { Prisma } from "@loom/database";
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

// The models that carry deletedAt — the only ones where a duplicate slug may be hiding in Trash
const TRASHABLE_MODELS = new Set([
  "Blog",
  "BlogLocale",
  "Category",
  "CategoryLocale",
  "Tag",
  "TagLocale",
  "Author",
  "Cta",
  "FeaturedArticles",
]);

interface ErrorBody {
  statusCode: number;
  message: string;
  error: string;
}

/**
 * Gives every error the same { success: false, ... } envelope the interceptor puts on successes.
 * This has to be a filter rather than the interceptor's catch: guards run before interceptors, so
 * a 403 from RoleGuard never reaches one — and a 403 is the most common error this API returns.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const payload =
        body && typeof body === "object"
          ? body
          : { message: exception.message };

      response
        .status(exception.getStatus())
        .json({ success: false, ...payload });
      return;
    }

    // Middleware errors (body-parser's 413, a malformed JSON 400) are http-errors objects rather
    // than HttpExceptions. They carry their real status; without this they reach the fallback below
    // and a "too large" or "bad JSON" becomes an unexplained 500.
    const middlewareStatus = this.statusOf(exception);
    if (middlewareStatus) {
      response.status(middlewareStatus).json({
        success: false,
        statusCode: middlewareStatus,
        message:
          middlewareStatus === HttpStatus.PAYLOAD_TOO_LARGE
            ? "That is too large to save in one request"
            : exception instanceof Error
              ? exception.message
              : "The request could not be read",
      });
      return;
    }

    const prismaError = this.fromPrisma(exception);
    if (prismaError) {
      response.status(prismaError.statusCode).json({
        success: false,
        ...prismaError,
      });
      return;
    }

    // Anything else is a bug rather than a rejected request, so it is logged and never echoed
    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }

  /**
   * A constraint violation is the caller's problem, not a server fault, and duplicate slugs and
   * names are the two things an operator most often gets wrong. Without this they arrive as an
   * unexplained 500 and the UI can only say "failed".
   */
  private fromPrisma(exception: unknown): ErrorBody | undefined {
    if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) return;

    switch (exception.code) {
      case "P2002":
        return {
          statusCode: HttpStatus.CONFLICT,
          error: "Conflict",
          message: this.duplicateMessage(exception),
        };
      case "P2025":
        return {
          statusCode: HttpStatus.NOT_FOUND,
          error: "Not Found",
          message: "That record no longer exists",
        };
      case "P2003":
        return {
          statusCode: HttpStatus.CONFLICT,
          error: "Conflict",
          message:
            "Something still references this record, so it cannot be deleted",
        };
      default:
        return;
    }
  }

  /** A client-error status an upstream middleware attached, or undefined for anything else. */
  private statusOf(exception: unknown): number | undefined {
    if (typeof exception !== "object" || exception === null) return;
    const status = (exception as { status?: unknown }).status;
    return typeof status === "number" && status >= 400 && status < 500
      ? status
      : undefined;
  }

  private duplicateMessage(
    exception: Prisma.PrismaClientKnownRequestError,
  ): string {
    const target = exception.meta?.target;
    const fields = Array.isArray(target) ? target.join(", ") : String(target);
    const model = String(exception.meta?.modelName ?? "");

    // Soft delete does not free a unique slug and Trash is kept forever, so for content the row
    // holding it is often in the Trash, where the operator will not think to look. Sites and
    // Spaces are hard-deleted, so that hint would send them somewhere with nothing in it.
    if (fields.includes("slug") && TRASHABLE_MODELS.has(model))
      return `That slug is already taken in this Space. If you cannot see the item using it, check the Trash — a trashed item keeps its slug until it is restored or permanently deleted.`;

    return `Another ${model || "record"} already uses that ${fields}`;
  }
}
