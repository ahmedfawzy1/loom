import {
  ChangePasswordRequestDto,
  CurrentUserResponseDto,
  LoginRequestDto,
  PasswordLinkDetailsResponseDto,
  PasswordLinkTokenRequestDto,
  SetPasswordRequestDto,
} from "@loom/dto";
import { SESSION_COOKIE_NAME } from "@loom/dto/constants";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
  SerializeOptions,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import type { AuthenticatedUser } from "./auth.types";
import { clientIp, readCookie } from "./auth-request.util";
import { CurrentUser } from "./current-user.decorator";
import { Public } from "./public.decorator";
import { SessionService } from "./session.service";

@Controller("admin")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @SerializeOptions({ type: CurrentUserResponseDto })
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser): CurrentUserResponseDto {
    return user;
  }

  @Public()
  @SerializeOptions({ type: CurrentUserResponseDto })
  @Post("auth/login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() args: LoginRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUserResponseDto> {
    const { user, token } = await this.authService.login(
      args,
      clientIp(request),
    );
    this.sessions.setCookie(response, token);
    return user;
  }

  /** Public, so a session that has already ended can still have its cookie cleared. */
  @Public()
  @Post("auth/logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
    if (token) await this.sessions.revoke(token);
    this.sessions.clearCookie(response);
  }

  /** A POST, so the token travels in a body and never in a URL a log could keep. */
  @Public()
  @SerializeOptions({ type: PasswordLinkDetailsResponseDto })
  @Post("auth/password-link")
  @HttpCode(HttpStatus.OK)
  passwordLink(
    @Body() args: PasswordLinkTokenRequestDto,
  ): Promise<PasswordLinkDetailsResponseDto> {
    return this.authService.passwordLinkDetails(args.token);
  }

  @Public()
  @SerializeOptions({ type: CurrentUserResponseDto })
  @Post("auth/set-password")
  @HttpCode(HttpStatus.OK)
  async setPassword(
    @Body() args: SetPasswordRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUserResponseDto> {
    const { user, token } = await this.authService.setPassword(args);
    this.sessions.setCookie(response, token);
    return user;
  }

  @Put("auth/password")
  changePassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
    @Body() args: ChangePasswordRequestDto,
  ): Promise<void> {
    // SessionGuard sets it on every request that reaches a route like this one
    const token = request.sessionToken ?? "";
    return this.authService.changePassword(actor, token, args);
  }
}
