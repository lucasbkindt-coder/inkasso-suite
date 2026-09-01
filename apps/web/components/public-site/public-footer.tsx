import Image from "next/image";
import Link from "next/link";

import payveoLogo from "../../../api/src/assets/branding/payveo-logo-primary-flat.png";

const footerGroups = [
  { title: "Unternehmen", links: [["Leistungen", "/leistungen"], ["Für Unternehmen", "/fuer-unternehmen"], ["Über payveo", "/ueber-payveo"]] },
  { title: "Informationen", links: [["Für Schuldner", "/fuer-schuldner"], ["Kontaktwege", "/kontakt"]] },
  { title: "Portale", links: [["Mandantenportal", "/portal/login"], ["Schuldnerportal", "/portal/login"]] },
  { title: "Rechtliches", links: [["Impressum", "/impressum"], ["Datenschutz", "/rechtliches/datenschutz"]] },
] as const;

export function PublicFooter() {
  return <footer className="border-t border-slate-200 bg-slate-950 text-white"><div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_2fr]"><div><Image alt="payveo" className="h-auto w-32 brightness-0 invert" src={payveoLogo} /><p className="mt-5 max-w-xs text-sm leading-6 text-slate-300">Klare Forderungsbearbeitung. Verbindlich für Mandanten, respektvoll gegenüber Schuldnern.</p></div><div className="grid grid-cols-2 gap-8 lg:grid-cols-4">{footerGroups.map((group)=><div key={group.title}><h2 className="text-sm font-semibold">{group.title}</h2><ul className="mt-4 space-y-3">{group.links.map(([label,href])=><li key={`${label}-${href}`}><Link className="text-sm text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#38a9e8]" href={href}>{label}</Link></li>)}</ul></div>)}</div></div><div className="border-t border-slate-800"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8"><div className="flex flex-wrap items-center gap-x-5 gap-y-2"><span>© {new Date().getFullYear()} payveo</span><Link className="transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#38a9e8]" href="/staff/login">Mitarbeiter-Login</Link></div><span>Forderungsmanagement mit Augenmaß.</span></div></div></footer>;
}
