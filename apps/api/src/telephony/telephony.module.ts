import { Module } from "@nestjs/common";

import { ActivityModule } from "../activity/activity.module";
import { DeskMailModule } from "../desk-mail/desk-mail.module";
import { TelephonyController } from "./telephony.controller";
import { TelephonyService } from "./telephony.service";

@Module({
  imports: [ActivityModule, DeskMailModule],
  controllers: [TelephonyController],
  providers: [TelephonyService],
  exports: [TelephonyService],
})
export class TelephonyModule {}
