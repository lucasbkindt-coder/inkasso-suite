import { CtaSection, PageHero, SectionIntro } from "@/components/public-site/public-elements";
import { PublicShell } from "@/components/public-site/public-shell";
import { publicMetadata } from "@/lib/public-metadata";

export const metadata = publicMetadata("Über payveo", "Haltung und Arbeitsweise von payveo im professionellen Forderungsmanagement.", "/ueber-payveo");

const principles = [
  ["Klarheit", "Forderungsgrund, Betrag und nächste Schritte sollen verständlich eingeordnet werden."],
  ["Verbindlichkeit", "Fristen, Vereinbarungen und Entscheidungen werden konsequent begleitet."],
  ["Nachvollziehbarkeit", "Kontakte, Zahlungen und Bearbeitungsstände bleiben im Zusammenhang des Vorgangs dokumentiert."],
  ["Respekt", "Professionelle Interessenvertretung und ein angemessener Umgang mit Schuldnern gehören zusammen."],
] as const;

export default function AboutPage() {
  return <PublicShell>
    <PageHero description="Wir verbinden konsequente Forderungsbearbeitung mit klarer Kommunikation und einem verantwortungsvollen Umgang mit allen Beteiligten." eyebrow="Über payveo" title="Professionell in der Sache. Angemessen im Umgang." />
    <section className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:py-24"><SectionIntro description="Ein Forderungsvorgang braucht belastbare Informationen, klare Entscheidungen und eine Kommunikation, die auch schwierige Sachverhalte verständlich macht." eyebrow="Unser Anspruch" title="Gute Bearbeitung beginnt mit guter Einordnung" /><div className="divide-y divide-slate-200 border-y border-slate-200">{principles.map(([title,text],index)=><article className="grid grid-cols-[3rem_1fr] gap-4 py-7" key={title}><span className="text-sm font-semibold text-[#007FC5]">0{index+1}</span><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div></article>)}</div></section>
    <section className="bg-slate-950 text-white"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-start lg:py-24"><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Digitale Abläufe schaffen Überblick. Sie ersetzen keine Verantwortung.</h2><div className="space-y-5 text-lg leading-8 text-slate-300"><p>Geordnete Informationen helfen, Vorgänge zuverlässig zu bearbeiten und Bearbeitungsstände nachvollziehbar zu halten.</p><p>Im Mittelpunkt bleibt die fachlich angemessene Entscheidung im einzelnen Forderungsverlauf.</p></div></div></section>
    <CtaSection description="Informieren Sie sich über die Zusammenarbeit oder nutzen Sie Ihren bestehenden Portalzugang." primary={["Für Unternehmen","/fuer-unternehmen"]} secondary={["Kontakt","/kontakt"]} title="Forderungsmanagement mit klarer Haltung" />
  </PublicShell>;
}
