import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { DataSubjectRequestsController } from "./data-subject-requests.controller";
import { DataSubjectRequestsService } from "./data-subject-requests.service";
@Module({imports:[CoreModule],controllers:[DataSubjectRequestsController],providers:[DataSubjectRequestsService]}) export class DataSubjectRequestsModule {}
