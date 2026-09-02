import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MailAccountProvider, MailAccountStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { CreateMailAccountDto, MailCredentialDto, UpdateMailAccountDto } from "./dto";
import { DeskMailTransportService } from "./mail-transport.service";
import { SecretEncryptionService } from "./secret-encryption.service";

@Injectable()
export class MailAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly encryption: SecretEncryptionService,
    private readonly transport: DeskMailTransportService,
  ) {}
  async list() {
    const tenantId = await this.tenant.getTenantId();
    return this.prisma.mailAccount.findMany({
      where: { tenantId },
      select: this.publicSelect(),
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }
  async create(dto: CreateMailAccountDto) {
    const tenantId = await this.tenant.getTenantId();
    if (dto.isDefault)
      await this.prisma.mailAccount.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    return this.prisma.mailAccount.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        emailAddress: dto.emailAddress.trim().toLowerCase(),
        displayName: dto.displayName?.trim() || null,
        provider: dto.provider,
        status:
          dto.provider === MailAccountProvider.MOCK
            ? MailAccountStatus.ACTIVE
            : MailAccountStatus.NOT_CONFIGURED,
        isDefault: dto.isDefault,
        inboundEnabled: dto.inboundEnabled,
        outboundEnabled: dto.outboundEnabled,
        outboundRateLimit: dto.outboundRateLimit,
      },
      select: this.publicSelect(),
    });
  }
  async update(id: string, dto: UpdateMailAccountDto) {
    const account = await this.find(id);
    if (
      dto.status === MailAccountStatus.ACTIVE &&
      account.provider === MailAccountProvider.GENERIC_SMTP_IMAP &&
      !(await this.prisma.mailAccountCredential.findUnique({
        where: { mailAccountId: id },
        select: { id: true },
      }))
    )
      throw new ConflictException(
        "Das generische Mailkonto kann erst nach sicherer Credential-Konfiguration aktiviert werden.",
      );
    if (dto.isDefault)
      await this.prisma.mailAccount.updateMany({
        where: { tenantId: account.tenantId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    return this.prisma.mailAccount.update({
      where: { id },
      data: { ...dto, name: dto.name?.trim(), displayName: dto.displayName?.trim() || undefined },
      select: this.publicSelect(),
    });
  }
  async credentials(id: string, dto: MailCredentialDto) {
    const account = await this.find(id);
    if (account.provider !== MailAccountProvider.GENERIC_SMTP_IMAP)
      throw new BadRequestException("MOCK-Mailkonten benötigen keine Credentials.");
    const encryptedPayload = this.encryption.encrypt(dto);
    await this.prisma.$transaction([
      this.prisma.mailAccountCredential.upsert({
        where: { mailAccountId: id },
        create: { mailAccountId: id, encryptedPayload },
        update: { encryptedPayload, encryptionVersion: 1 },
      }),
      this.prisma.mailAccount.update({ where: { id }, data: { status: MailAccountStatus.ACTIVE } }),
    ]);
    return { configured: true };
  }
  async test(id: string) {
    const account = await this.find(id);
    if (account.provider === MailAccountProvider.GENERIC_SMTP_IMAP) {
      const credential = await this.prisma.mailAccountCredential.findUnique({
        where: { mailAccountId: id },
        select: { encryptedPayload: true },
      });
      if (!credential) return { configured: false, connected: false, provider: account.provider };
      this.encryption.decrypt<MailCredentialDto>(credential.encryptedPayload);
    }
    return this.transport.test(account);
  }
  async find(id: string) {
    const tenantId = await this.tenant.getTenantId();
    const item = await this.prisma.mailAccount.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException("Mailkonto wurde nicht gefunden.");
    return item;
  }
  publicSelect() {
    return {
      id: true,
      name: true,
      emailAddress: true,
      displayName: true,
      provider: true,
      status: true,
      isDefault: true,
      inboundEnabled: true,
      outboundEnabled: true,
      outboundRateLimit: true,
      createdAt: true,
      updatedAt: true,
      credential: { select: { id: true, encryptionVersion: true, updatedAt: true } },
    } as const;
  }
}
