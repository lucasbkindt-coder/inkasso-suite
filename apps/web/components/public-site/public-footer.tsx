import Image from "next/image";
import Link from "next/link";

import payveoLogo from "../../../api/src/assets/branding/payveo-logo-primary-flat.png";

const footerGroups = [
  { title: "payveo", links: [["Leistungen", "/leistungen"], ["Für Unternehmen", "/fuer-unternehmen"], ["Für Schuldner", "/fuer-schuldner"], ["Über payveo", "/ueber-payveo"]] },
  { title: "Kontakt", links: [["Kontaktwege", "/kontakt"], ["Mandantenportal", "/portal/login"], ["Schuldnerportal", "/portal/login"]] },
  { title: "Rechtliches", links: [["Impressum", "/impressum"], ["Datenschutz", "/rechtliches/datenschutz"]] },
] as const;

export function PublicFooter() {
  return <footer className="border-t border-slate-200 bg-slate-950 text-white"><div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1.2fr_2fr]"><div><Image alt="payveo" className="h-auto w-36 brightness-0 invert" src={payveoLogo} /><p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">Professionelles Forderungsmanagement mit klaren Abläufen, nachvollziehbarer Kommunikation und respektvollem Umgang.</p></div><div className="grid gap-8 sm:grid-cols-3">{footerGroups.map((group)=><div key={group.title}><h2 className="text-sm font-semibold">{group.title}</h2><ul className="mt-4 space-y-3">{group.links.map(([label,href])=><li key={`${label}-${href}`}><Link className="text-sm text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#38a9e8]" href={href}>{label}</Link></li>)}</ul></div>)}</div></div><div className="border-t border-slate-800"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© {new Date().getFullYear()} payveo</span><span>Forderungsmanagement mit Augenmaß.</span></div></div></footer>;
}
