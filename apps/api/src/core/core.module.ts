import { Global, Module } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";

@Global()
@Module({
  providers: [PrismaService, TenantContextService],
  exports: [PrismaService, TenantContextService],
})
export class CoreModule {}
