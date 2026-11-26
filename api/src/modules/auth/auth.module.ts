import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LoginThrottle } from "./login-throttle";
import { PasswordLinkService } from "./password-link.service";
import { SessionService } from "./session.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService, LoginThrottle, PasswordLinkService, SessionService],
  // UserService makes links for the people an Admin adds, and ends the sessions of anyone disabled
  exports: [PasswordLinkService, SessionService],
})
export class AuthModule {}
