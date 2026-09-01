"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import payveoLogo from "../../../api/src/assets/branding/payveo-logo-primary-flat.png";

const navigation = [
  ["Leistungen", "/leistungen"],
  ["Für Unternehmen", "/fuer-unternehmen"],
  ["Für Schuldner", "/fuer-schuldner"],
  ["Über payveo", "/ueber-payveo"],
  ["Kontakt", "/kontakt"],
] as const;

export function PublicHeader() {
  const [open, setOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
        <Link aria-label="payveo Startseite" className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#007FC5]" href="/">
          <Image alt="payveo" className="h-auto w-32" priority src={payveoLogo} />
        </Link>
        <nav aria-label="Öffentliche Hauptnavigation" className="hidden items-center gap-6 xl:flex">
          {navigation.map(([label, href]) => <Link className="text-sm font-medium text-slate-700 transition hover:text-[#007FC5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#007FC5]" href={href} key={href}>{label}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 xl:flex">
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-[#007FC5] hover:text-[#007FC5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007FC5]" href="/portal/login">Mandantenportal</Link>
          <Link className="rounded-full bg-[#007FC5] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#006da9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007FC5]" href="/portal/login">Schuldnerportal</Link>
        </div>
        <button aria-controls="public-mobile-navigation" aria-expanded={open} aria-label={open ? "Menü schließen" : "Menü öffnen"} className="grid size-11 place-items-center rounded-full border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007FC5] xl:hidden" onClick={() => setOpen((value) => !value)} type="button">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open ? <nav aria-label="Mobile Hauptnavigation" className="border-t border-slate-200 bg-white px-5 py-5 xl:hidden" id="public-mobile-navigation">
        <div className="mx-auto grid max-w-7xl gap-1">
          {navigation.map(([label, href]) => <Link className="rounded-xl px-3 py-3 text-base font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#007FC5]" href={href} key={href} onClick={() => setOpen(false)}>{label}</Link>)}
          <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4 sm:grid-cols-2">
            <Link className="rounded-full border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-800" href="/portal/login" onClick={() => setOpen(false)}>Mandantenportal</Link>
            <Link className="rounded-full bg-[#007FC5] px-4 py-3 text-center text-sm font-semibold text-white" href="/portal/login" onClick={() => setOpen(false)}>Schuldnerportal</Link>
          </div>
        </div>
      </nav> : null}
    </header>
  );
}
