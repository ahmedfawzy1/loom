import { Module } from "@nestjs/common";
import { CtaController } from "./cta.controller";
import { CtaService } from "./cta.service";

@Module({
  controllers: [CtaController],
  providers: [CtaService],
  exports: [CtaService],
})
export class CtaModule {}
