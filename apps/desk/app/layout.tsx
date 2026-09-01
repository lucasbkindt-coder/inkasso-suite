import type { Metadata } from "next";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "payveo Desk",
  description: "Kommunikationsarbeitsbereich für payveo",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de" suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider></body></html>;
}
