import { Module } from "@nestjs/common";
import { RevalidateController } from "./revalidate.controller";
import { RevalidateService } from "./revalidate.service";

@Module({
  controllers: [RevalidateController],
  providers: [RevalidateService],
  exports: [RevalidateService],
})
export class RevalidateModule {}
