import type { ReactNode } from "react";

import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";

export function PublicShell({ children }: { children: ReactNode }) {
  return <div className="public-site min-h-screen bg-white text-slate-950"><PublicHeader /><main>{children}</main><PublicFooter /></div>;
}
