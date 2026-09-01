import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";

import { ZohoDeskConfigService } from "./zoho-desk.config";

export const ZOHO_DESK_FETCH = Symbol("ZOHO_DESK_FETCH");
export type ZohoDeskFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

type ZohoListResponse<T> = { data?: T[] };
type ZohoTokenResponse = { access_token?: string; expires_in?: number; error?: string };

export type ZohoDeskContact = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
};

export type ZohoDeskTicket = {
  id: string;
  ticketNumber: string | null;
  subject: string;
  status: string;
  contact: { id: string | null; name: string | null; email: string | null } | null;
  createdTime: string | null;
  modifiedTime: string | null;
  webUrl: string;
};

@Injectable()
export class ZohoDeskClient {
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: ZohoDeskConfigService,
    @Inject(ZOHO_DESK_FETCH) private readonly http: ZohoDeskFetch,
  ) {}

  async organizations() {
    const response = await this.request<ZohoListResponse<Record<string, unknown>>>(
      "/organizations",
      { includeOrgId: false },
    );
    return response.data ?? [];
  }

  async searchContacts(query: string) {
    const response = await this.request<ZohoListResponse<Record<string, unknown>>>(
      `/contacts/search?searchStr=${encodeURIComponent(query)}&from=0&limit=25`,
    );
    return (response.data ?? []).map((item) => this.contact(item));
  }

  async contactById(externalId: string) {
    this.assertExternalId(externalId);
    return this.contact(
      await this.request<Record<string, unknown>>(`/contacts/${externalId}`, {
        notFoundMessage: "Der Zoho-Kontakt wurde nicht gefunden.",
      }),
    );
  }

  async searchTickets(query: string) {
    const response = await this.request<ZohoListResponse<Record<string, unknown>>>(
      `/tickets/search?searchStr=${encodeURIComponent(query)}&from=0&limit=25`,
    );
    return (response.data ?? []).map((item) => this.ticket(item));
  }

  async ticketById(externalId: string) {
    this.assertExternalId(externalId);
    return this.ticket(
      await this.request<Record<string, unknown>>(`/tickets/${externalId}`, {
        notFoundMessage: "Das Zoho-Ticket wurde nicht gefunden.",
      }),
    );
  }

  private async request<T>(
    path: string,
    options: { includeOrgId?: boolean; notFoundMessage?: string } = {},
  ): Promise<T> {
    const configuration = this.config.require();
    const response = await this.withTimeout(`${configuration.apiBaseUrl}${path}`, {
      method: "GET",
      headers: {
        authorization: `Zoho-oauthtoken ${await this.token()}`,
        ...(options.includeOrgId === false ? {} : { orgId: configuration.orgId }),
      },
    });
    if (response.status === 404 && options.notFoundMessage)
      throw new NotFoundException(options.notFoundMessage);
    if (!response.ok)
      throw await this.normalizedError(response, "Zoho Desk konnte die Anfrage nicht verarbeiten.");
    return this.json<T>(response, "Zoho Desk hat eine ungültige Antwort geliefert.");
  }

  private async token() {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 30_000)
      return this.accessToken.value;
    const configuration = this.config.require();
    const body = new URLSearchParams({
      refresh_token: configuration.refreshToken,
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      grant_type: "refresh_token",
    });
    const response = await this.withTimeout(`${configuration.accountsBaseUrl}/oauth/v2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok)
      throw await this.normalizedError(response, "Die Zoho-Authentifizierung ist fehlgeschlagen.");
    const payload = await this.json<ZohoTokenResponse>(
      response,
      "Zoho hat keine gültige OAuth-Antwort geliefert.",
    );
    if (!payload.access_token)
      throw new BadGatewayException("Zoho hat kein Zugriffstoken geliefert.");
    this.accessToken = {
      value: payload.access_token,
      expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 3600) * 1000,
    };
    return payload.access_token;
  }

  private async withTimeout(url: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      return await this.http(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError")
        throw new ServiceUnavailableException("Die Zoho-Anfrage hat das Zeitlimit überschritten.");
      throw new ServiceUnavailableException("Zoho Desk ist derzeit nicht erreichbar.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async normalizedError(response: Response, fallback: string) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
      errorCode?: string;
      error?: string;
    } | null;
    const code = payload?.errorCode ?? payload?.error;
    return new BadGatewayException(code ? `${fallback} (${code})` : fallback);
  }

  private async json<T>(response: Response, message: string): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      throw new BadGatewayException(message);
    }
  }

  private contact(item: Record<string, unknown>): ZohoDeskContact {
    const firstName = this.optionalString(item.firstName);
    const lastName = this.optionalString(item.lastName);
    return {
      id: this.requiredExternalId(item.id),
      displayName:
        [firstName, lastName].filter(Boolean).join(" ") ||
        this.optionalString(item.name) ||
        "Unbenannter Kontakt",
      firstName,
      lastName,
      email: this.optionalString(item.email),
      phone: this.optionalString(item.phone),
      mobile: this.optionalString(item.mobile),
    };
  }

  private ticket(item: Record<string, unknown>): ZohoDeskTicket {
    const externalId = this.requiredExternalId(item.id);
    const contact =
      item.contact && typeof item.contact === "object"
        ? (item.contact as Record<string, unknown>)
        : null;
    return {
      id: externalId,
      ticketNumber: this.optionalString(item.ticketNumber ?? item.number),
      subject: this.optionalString(item.subject) ?? "Ohne Betreff",
      status: this.optionalString(item.status) ?? "Unbekannt",
      contact: contact
        ? {
            id: this.optionalString(contact.id),
            name: this.optionalString(contact.name),
            email: this.optionalString(contact.email),
          }
        : null,
      createdTime: this.optionalString(item.createdTime),
      modifiedTime: this.optionalString(item.modifiedTime),
      webUrl: this.config.ticketWebUrl(externalId),
    };
  }

  private requiredExternalId(value: unknown) {
    const id = this.optionalString(value);
    if (!id || !/^\d+$/.test(id))
      throw new BadGatewayException("Zoho Desk hat eine ungültige externe ID geliefert.");
    return id;
  }

  private assertExternalId(value: string) {
    if (!/^\d+$/.test(value)) throw new NotFoundException("Die externe Zoho-ID ist ungültig.");
  }

  private optionalString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
}
