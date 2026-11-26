import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { SSE_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";

/** Wraps successful responses as { success, data }. Errors are shaped by HttpExceptionFilter. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // SSE handlers emit MessageEvents that Nest serialises into event/data lines; wrapping them
    // would break that shape. Bulk translation progress streams this way.
    if (this.reflector.get<boolean>(SSE_METADATA, context.getHandler()))
      return next.handle();

    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}
