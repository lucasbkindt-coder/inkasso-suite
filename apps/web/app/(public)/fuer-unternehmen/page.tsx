import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { CtaSection, PageHero, PrimaryLink, SecondaryLink, SectionIntro } from "@/components/public-site/public-elements";
import { PublicShell } from "@/components/public-site/public-shell";
import { publicMetadata } from "@/lib/public-metadata";

export const metadata = publicMetadata("Forderungsmanagement für Unternehmen", "Offene Forderungen geordnet übergeben und professionell bearbeiten lassen.", "/fuer-unternehmen");

const steps = [
  ["01", "Forderung übergeben", "Bestehende Mandanten übermitteln die erforderlichen Angaben geschützt über das Mandantenportal."],
  ["02", "Sachverhalt prüfen", "Forderungsgrund, Dokumente und bisheriger Verlauf werden zusammengeführt und eingeordnet."],
  ["03", "Schuldner kontaktieren", "Die Kommunikation erfolgt verbindlich, nachvollziehbar und mit angemessenem Ton."],
  ["04", "Zahlung begleiten", "Eingänge, Vereinbarungen und offene Beträge werden dem Vorgang korrekt zugeordnet."],
  ["05", "Status nachvollziehen", "Freigegebene Bearbeitungsstände bleiben für den Mandanten digital einsehbar."],
] as const;

export default function CompaniesPage() {
  return <PublicShell>
    <PageHero description="payveo übernimmt offene Forderungen in einen klaren Bearbeitungsprozess. Sie gewinnen Zeit, behalten den Überblick und wissen, wie der Vorgang weitergeführt wird." eyebrow="Für Unternehmen" title="Konsequente Forderungsbearbeitung entlastet Ihr Unternehmen"><PrimaryLink href="/portal/login">Zum Mandantenportal</PrimaryLink><SecondaryLink href="/kontakt">Zusammenarbeit anfragen</SecondaryLink></PageHero>
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24"><SectionIntro description="Jeder Vorgang wird fachlich eingeordnet. So entsteht ein nachvollziehbarer Verlauf statt einer Folge isolierter Einzelmaßnahmen." eyebrow="Zusammenarbeit" title="Vom offenen Posten zum klaren Bearbeitungsstand" /><ol className="mt-12 border-y border-slate-200">{steps.map(([number,title,text])=><li className="grid gap-3 border-b border-slate-200 py-7 last:border-b-0 sm:grid-cols-[4rem_15rem_1fr] sm:items-start" key={number}><span className="text-sm font-semibold text-[#007FC5]">{number}</span><h2 className="font-semibold text-slate-950">{title}</h2><p className="max-w-2xl text-sm leading-6 text-slate-600">{text}</p></li>)}</ol></section>
    <section className="bg-slate-950 text-white"><div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:py-24"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#38a9e8]">Entlastung im Tagesgeschäft</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Forderungen abgeben, Verantwortung im Blick behalten</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">payveo übernimmt die strukturierte Bearbeitung und hält wesentliche Entwicklungen nachvollziehbar. Entscheidungen bleiben am konkreten Forderungsverlauf ausgerichtet.</p></div><ul className="space-y-5">{["Geordnete Übernahme von Forderungs- und Schuldnerdaten","Professioneller Kontakt mit Schuldnern","Nachvollziehbare Einordnung von Zahlungen und Vereinbarungen","Transparenter Bearbeitungsstand für bestehende Mandanten"].map(item=><li className="flex gap-3 text-sm leading-6 text-slate-200" key={item}><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#38a9e8]" />{item}</li>)}</ul></div></section>
    <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:py-24"><SectionIntro description="Der geschützte Zugang ist Teil der laufenden Zusammenarbeit. Er schafft Überblick, ohne die persönliche und fachliche Bearbeitung zu ersetzen." eyebrow="Mandantenportal" title="Bearbeitungsstände digital nachvollziehen" /><aside className="border-l-4 border-[#007FC5] bg-[#f5f9fc] p-8"><h2 className="text-xl font-semibold">Für bestehende Mandanten</h2><p className="mt-4 leading-7 text-slate-700">Neue Inkassoaufträge übermitteln, vorhandene Vorgänge einsehen und wesentliche Informationen an einem geschützten Ort nachvollziehen.</p><Link className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#006da9]" href="/portal/login">Mandantenportal öffnen <ArrowRight className="size-4" /></Link></aside></section>
    <CtaSection description="Bestehende Mandanten können neue Vorgänge direkt über ihren geschützten Zugang übermitteln." primary={["Mandantenportal öffnen","/portal/login"]} secondary={["Kontaktwege","/kontakt"]} title="Offene Forderungen geordnet übergeben" />
  </PublicShell>;
}
