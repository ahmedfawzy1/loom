import { Module } from "@nestjs/common";
import { SpaceController } from "./space.controller";
import { SpaceService } from "./space.service";
import { SpaceCloneService } from "./space-clone.service";

@Module({
  controllers: [SpaceController],
  providers: [SpaceService, SpaceCloneService],
  exports: [SpaceService],
})
export class SpaceModule {}
