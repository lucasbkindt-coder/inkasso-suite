import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { DebtorsController } from "./debtors.controller";
import { DebtorsService } from "./debtors.service";

@Module({ imports: [CoreModule], controllers: [DebtorsController], providers: [DebtorsService] })
export class DebtorsModule {}
