import type { Metadata } from "next";

const siteUrl = new URL("https://www.payveo.de");

export function publicMetadata(title: string, description: string, path: string): Metadata {
  const canonical = new URL(path, siteUrl);
  return {
    title: `${title} | payveo`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "de_DE",
      siteName: "payveo",
      title,
      description,
      url: canonical,
    },
  };
}
