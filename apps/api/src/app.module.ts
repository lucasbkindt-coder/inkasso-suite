import { Module } from "@nestjs/common";

import { DebtorsModule } from "./debtors/debtors.module";
import { PrismaService } from "./prisma/prisma.service";
import { TenantContextService } from "./tenant/tenant-context.service";

@Module({ imports: [DebtorsModule], providers: [PrismaService, TenantContextService] })
export class AppModule {}
