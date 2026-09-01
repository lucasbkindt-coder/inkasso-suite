import { ArrowRight, FileCheck2, Landmark, MessageSquareText, SearchCheck, WalletCards } from "lucide-react";
import Link from "next/link";

import { CtaSection, PrimaryLink, SecondaryLink, SectionIntro } from "./public-elements";

const process = [
  ["01", "Forderung übergeben"],
  ["02", "Sachverhalt prüfen"],
  ["03", "Kontakt aufnehmen"],
  ["04", "Zahlung begleiten"],
  ["05", "Status nachvollziehen"],
] as const;

const supportingServices = [
  [WalletCards, "Zahlungen und Ratenlösungen", "Zahlungseingänge zuordnen und Vereinbarungen nachvollziehbar begleiten."],
  [Landmark, "Gerichtliche Schritte", "Weitere Maßnahmen anhand des Bearbeitungsstands kontrolliert vorbereiten."],
  [SearchCheck, "Adressklärung", "Fehlende Anschriften als eigenen, dokumentierten Prüfschritt bearbeiten."],
] as const;

export function PublicHome() {
  return <>
    <section className="overflow-hidden border-b border-slate-200 bg-[#f5f9fc]">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#006da9]">Forderungsmanagement für Unternehmen</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-[3.8rem]">Forderungen klar bearbeiten. Menschen fair begegnen.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-700">payveo übernimmt offene Forderungen in einen geordneten Prozess – mit verbindlicher Bearbeitung für Mandanten und verständlicher Kommunikation gegenüber Schuldnern.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><PrimaryLink href="/fuer-unternehmen">Für Unternehmen</PrimaryLink><SecondaryLink href="/portal/login">Vorgang als Schuldner aufrufen</SecondaryLink></div>
        </div>
        <div aria-hidden className="relative mx-auto h-[25rem] w-full max-w-lg sm:h-[29rem]">
          <div className="absolute inset-x-10 bottom-3 top-12 rotate-[-4deg] rounded-[2rem] bg-[#007FC5]" />
          <div className="absolute inset-x-3 bottom-8 top-3 rotate-[2deg] rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-7 py-6"><span className="text-sm font-semibold text-slate-900">Forderungssache</span><span className="text-xs font-semibold text-[#006da9]">GEORDNET</span></div>
            <div className="space-y-7 px-7 py-8"><div><div className="h-2.5 w-28 rounded bg-slate-900" /><div className="mt-3 h-2 w-full rounded bg-slate-200" /><div className="mt-2 h-2 w-4/5 rounded bg-slate-200" /></div>{[["Prüfung","Sachverhalt eingeordnet"],["Kommunikation","Kontakt dokumentiert"],["Zahlung","Stand nachvollziehbar"]].map(([label,value])=><div className="grid grid-cols-[7rem_1fr] gap-4 border-t border-slate-100 pt-5" key={label}><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span><span className="text-sm font-medium text-slate-700">{value}</span></div>)}</div>
          </div>
          <div className="absolute bottom-0 right-0 h-24 w-24 rounded-tl-[2.5rem] bg-slate-950" />
        </div>
      </div>
    </section>

    <section className="border-b border-slate-200 bg-white"><div className="mx-auto grid max-w-7xl divide-y divide-slate-200 px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0">{[["Klar in der Sache","Forderungen und nächste Schritte verständlich einordnen."],["Verbindlich im Prozess","Fristen, Zahlungen und Entscheidungen konsequent begleiten."],["Respektvoll im Kontakt","Professionell kommunizieren, auch wenn Interessen auseinandergehen."]].map(([title,text])=><div className="py-8 md:px-8 md:first:pl-0 md:last:pr-0" key={title}><h2 className="font-semibold text-slate-950">{title}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{text}</p></div>)}</div></section>

    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24"><SectionIntro description="Wir begleiten den Forderungsverlauf vom außergerichtlichen Kontakt bis zur Vorbereitung weiterer Schritte. Was erforderlich ist, entscheidet der konkrete Vorgang – nicht ein starrer Automatismus." eyebrow="Leistungen" title="Konzentriert auf das, was Forderungen voranbringt" /><div className="mt-12 grid gap-10 lg:grid-cols-[1.05fr_0.95fr]"><article className="flex min-h-80 flex-col justify-between rounded-[2rem] bg-slate-950 p-8 text-white sm:p-10"><div><FileCheck2 className="size-7 text-[#38a9e8]" /><h3 className="mt-8 max-w-lg text-3xl font-semibold tracking-tight">Außergerichtliche Forderungsbearbeitung</h3><p className="mt-4 max-w-lg leading-7 text-slate-300">Vollständige Angaben, ein klarer Forderungsgrund und dokumentierte Kommunikation bilden die Grundlage für eine belastbare Bearbeitung.</p></div><Link className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-[#38a9e8]" href="/leistungen">Leistungen im Detail <ArrowRight className="size-4" /></Link></article><div className="divide-y divide-slate-200 border-y border-slate-200">{supportingServices.map(([Icon,title,text])=><article className="grid grid-cols-[2.75rem_1fr] gap-5 py-6 sm:py-7" key={title}><Icon className="mt-1 size-5 text-[#007FC5]" /><div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div></article>)}</div></div></section>

    <section className="border-y border-slate-200 bg-[#f5f9fc]"><div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24"><SectionIntro description="Der Ablauf bleibt für Mandanten nachvollziehbar und wird für jeden Vorgang fachlich eingeordnet." eyebrow="Arbeitsweise" title="Fünf Schritte. Ein klarer Bearbeitungsstand." /><ol className="mt-12 grid gap-0 border-y border-slate-300 md:grid-cols-5">{process.map(([number,label])=><li className="relative border-b border-slate-300 py-6 last:border-b-0 md:border-b-0 md:border-r md:px-5 md:last:border-r-0 md:first:pl-0" key={number}><span className="text-sm font-semibold text-[#007FC5]">{number}</span><p className="mt-3 max-w-40 font-semibold text-slate-900">{label}</p></li>)}</ol></div></section>

    <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:py-24"><div><SectionIntro description="Bestehende Mandanten übermitteln neue Vorgänge geschützt und können freigegebene Bearbeitungsstände einsehen. Der Portalzugang ergänzt die persönliche und fachliche Bearbeitung." eyebrow="Für Unternehmen" title="Entlastung durch geordnete Forderungsbearbeitung" /><div className="mt-8"><PrimaryLink href="/fuer-unternehmen">Zusammenarbeit kennenlernen</PrimaryLink></div></div><aside className="border-l-4 border-[#007FC5] bg-[#f5f9fc] p-7 sm:p-9"><p className="text-sm font-semibold text-[#006da9]">Mandantenportal</p><h3 className="mt-3 text-2xl font-semibold">Bearbeitungsstände digital nachvollziehen</h3><p className="mt-4 leading-7 text-slate-700">Neue Forderungen übergeben, vorhandene Vorgänge aufrufen und wesentliche Informationen im Blick behalten.</p><Link className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#006da9]" href="/portal/login">Zum Mandantenportal <ArrowRight className="size-4" /></Link></aside></section>

    <section className="bg-slate-950 text-white"><div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-24"><div className="flex size-24 items-end rounded-[2rem] border border-slate-700 p-5"><MessageSquareText className="size-7 text-[#38a9e8]" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#38a9e8]">Für Schuldner</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Ein Schreiben erhalten? Hier finden Sie Orientierung.</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Im geschützten Portal sehen Sie freigegebene Angaben, Dokumente, Zahlungen und bestehende Ratenvereinbarungen zu Ihrem Vorgang.</p><div className="mt-8"><Link className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-950" href="/portal/login">Zum Schuldnerportal <ArrowRight className="size-4" /></Link></div></div></div></section>

    <CtaSection description="Erfahren Sie, wie payveo offene Forderungen geordnet übernimmt und professionell begleitet." primary={["Für Unternehmen", "/fuer-unternehmen"]} secondary={["Kontaktwege", "/kontakt"]} title="Offene Forderungen strukturiert angehen" />
  </>;
}
