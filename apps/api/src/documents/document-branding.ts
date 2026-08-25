import { existsSync } from "node:fs";
import { join } from "node:path";

export const documentBranding = {
  brandName: "payveo",
  companyDisplayName: "payveo",
  primaryColor: "#007FC5",
  mutedLineColor: "#A8CDE3",
  logoWidth: 118,
} as const;

export function documentLogoPath() {
  const source = join(process.cwd(), "src", "assets", "branding", "payveo-logo-primary-flat.png");
  if (existsSync(source)) return source;
  const workspace = join(process.cwd(), "apps", "api", "assets", "branding", "payveo-logo-primary-flat.png");
  if (existsSync(workspace)) return workspace;
  return join(process.cwd(), "dist", "assets", "branding", "payveo-logo-primary-flat.png");
}
