import { Injectable, ServiceUnavailableException } from "@nestjs/common";

export type ZohoDeskRegion = "EU" | "US" | "IN" | "AU" | "JP" | "CA";

type RegionEndpoints = {
  accountsBaseUrl: string;
  apiBaseUrl: string;
  webBaseUrl: string;
};

const endpoints: Record<ZohoDeskRegion, RegionEndpoints> = {
  EU: {
    accountsBaseUrl: "https://accounts.zoho.eu",
    apiBaseUrl: "https://desk.zoho.eu/api/v1",
    webBaseUrl: "https://desk.zoho.eu",
  },
  US: {
    accountsBaseUrl: "https://accounts.zoho.com",
    apiBaseUrl: "https://desk.zoho.com/api/v1",
    webBaseUrl: "https://desk.zoho.com",
  },
  IN: {
    accountsBaseUrl: "https://accounts.zoho.in",
    apiBaseUrl: "https://desk.zoho.in/api/v1",
    webBaseUrl: "https://desk.zoho.in",
  },
  AU: {
    accountsBaseUrl: "https://accounts.zoho.com.au",
    apiBaseUrl: "https://desk.zoho.com.au/api/v1",
    webBaseUrl: "https://desk.zoho.com.au",
  },
  JP: {
    accountsBaseUrl: "https://accounts.zoho.jp",
    apiBaseUrl: "https://desk.zoho.jp/api/v1",
    webBaseUrl: "https://desk.zoho.jp",
  },
  CA: {
    accountsBaseUrl: "https://accounts.zohocloud.ca",
    apiBaseUrl: "https://desk.zohocloud.ca/api/v1",
    webBaseUrl: "https://desk.zohocloud.ca",
  },
};

export type ZohoDeskConfiguration = RegionEndpoints & {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  orgId: string;
  region: ZohoDeskRegion;
};

export type ZohoDeskConfigurationStatus = {
  configured: boolean;
  region: string;
  missing: string[];
  configurationError: string | null;
};

@Injectable()
export class ZohoDeskConfigService {
  status(): ZohoDeskConfigurationStatus {
    const values = this.values();
    const missing = Object.entries(values)
      .filter(([key, value]) => key !== "region" && !value)
      .map(([key]) => key);
    const region = values.region.toUpperCase();
    const configurationError =
      region in endpoints ? null : "Die konfigurierte Zoho-Region wird nicht unterstützt.";
    return {
      configured: missing.length === 0 && !configurationError,
      region,
      missing,
      configurationError,
    };
  }

  require(): ZohoDeskConfiguration {
    const status = this.status();
    if (!status.configured) {
      throw new ServiceUnavailableException(
        status.configurationError ?? "Zoho Desk ist nicht vollständig konfiguriert.",
      );
    }
    const values = this.values();
    const region = status.region as ZohoDeskRegion;
    return {
      ...endpoints[region],
      region,
      clientId: values.clientId,
      clientSecret: values.clientSecret,
      refreshToken: values.refreshToken,
      orgId: values.orgId,
    };
  }

  ticketWebUrl(externalId: string) {
    if (!/^\d+$/.test(externalId))
      throw new ServiceUnavailableException("Die externe Ticket-ID ist ungültig.");
    const configuration = this.require();
    return `${configuration.webBaseUrl}/agent/tickets/${externalId}`;
  }

  private values() {
    return {
      clientId: process.env.ZOHO_DESK_CLIENT_ID?.trim() ?? "",
      clientSecret: process.env.ZOHO_DESK_CLIENT_SECRET?.trim() ?? "",
      refreshToken: process.env.ZOHO_DESK_REFRESH_TOKEN?.trim() ?? "",
      orgId: process.env.ZOHO_DESK_ORG_ID?.trim() ?? "",
      region: process.env.ZOHO_DESK_REGION?.trim() || "EU",
    };
  }
}
