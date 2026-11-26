import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { ApiKeyService } from "./api-key.service";

/** Content API authentication: `Authorization: Bearer <key>`, checked against the Site in the URL. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, key] = (request.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !key)
      throw new UnauthorizedException("Send the API key as a Bearer token");

    request.apiKey = await this.apiKeyService.authenticate(
      key,
      String(request.params.site),
    );
    return true;
  }
}
