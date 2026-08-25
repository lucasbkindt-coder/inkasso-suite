import { Global, Module } from "@nestjs/common";

import { CoreModule } from "../core/core.module";
import { ActivityService } from "./activity.service";

@Global()
@Module({ imports: [CoreModule], providers: [ActivityService], exports: [ActivityService] })
export class ActivityModule {}
