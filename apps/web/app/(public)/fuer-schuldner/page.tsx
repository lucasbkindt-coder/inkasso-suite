import { ArrowRight, CircleHelp, FileText, HandCoins, WalletCards } from "lucide-react";
import Link from "next/link";

import { CtaSection, PageHero, PrimaryLink, SectionIntro } from "@/components/public-site/public-elements";
import { PublicShell } from "@/components/public-site/public-shell";
import { publicMetadata } from "@/lib/public-metadata";

export const metadata = publicMetadata("Informationen für Schuldner", "Ein Schreiben von payveo erhalten? Hier finden Sie Hinweise und den Zugang zu Ihrem Vorgang.", "/fuer-schuldner");

const answers = [
  [CircleHelp, "Warum habe ich ein Schreiben erhalten?", "Ein Gläubiger hat payveo mit der Bearbeitung einer offenen Forderung beauftragt. Angaben zu Gläubiger, Forderungsgrund und Betrag finden Sie in Ihrem Schreiben und im geschützten Portal."],
  [FileText, "Wo sehe ich meinen Vorgang und die Dokumente?", "Melden Sie sich mit der Login-ID aus Ihren Unterlagen im Schuldnerportal an. Dort sehen Sie ausschließlich die für Ihren Vorgang freigegebenen Informationen."],
  [WalletCards, "Wo finde ich Zahlungen und den offenen Stand?", "Dokumentierte Zahlungen und der aktuelle Forderungsstand werden im Portal dem betreffenden Vorgang zugeordnet dargestellt."],
  [HandCoins, "Was kann ich bei Zahlungsproblemen tun?", "Prüfen Sie frühzeitig, ob im Portal eine Ratenanfrage angeboten wird. Bereits vereinbarte Raten und Fälligkeiten können Sie dort ebenfalls nachvollziehen."],
] as const;

export default function DebtorsPublicPage() {
  return <PublicShell>
    <PageHero description="Prüfen Sie die Angaben in Ruhe. Über den geschützten Portalzugang sehen Sie Dokumente, Zahlungen und weitere Informationen zu Ihrem Vorgang." eyebrow="Für Schuldner" title="Sie haben ein Schreiben von payveo erhalten?"><PrimaryLink href="/portal/login">Vorgang im Portal aufrufen</PrimaryLink></PageHero>
    <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:py-24"><div><SectionIntro description="Die wichtigsten Antworten zu Ihrem Schreiben und dem weiteren Vorgehen." eyebrow="Orientierung" title="Was Sie jetzt wissen sollten" /><p className="mt-6 max-w-sm text-sm leading-6 text-slate-600">Halten Sie bei Rückfragen das payveo-Aktenzeichen aus Ihrem Schreiben bereit. Öffentliche Seiten zeigen keine persönlichen Vorgangsdaten.</p></div><div className="divide-y divide-slate-200 border-y border-slate-200">{answers.map(([Icon,title,text])=><article className="grid gap-4 py-7 sm:grid-cols-[3rem_1fr]" key={title}><Icon className="mt-0.5 size-5 text-[#007FC5]" /><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></div></article>)}</div></section>
    <section className="bg-[#f5f9fc]"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#006da9]">Geschützter Zugang</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Login-ID aus Ihrem Schreiben verwenden</h2><p className="mt-4 max-w-2xl leading-7 text-slate-700">Ist Ihr Zugang noch nicht aktiviert, können Sie die Aktivierung auf der bestehenden Loginseite beginnen. Für die Anmeldung ist keine öffentliche Fallauskunft erforderlich.</p></div><Link className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007FC5] px-6 py-3 text-sm font-semibold text-white" href="/portal/login">Zum Schuldnerportal <ArrowRight className="size-4" /></Link></div></section>
    <CtaSection description="Melden Sie sich mit Ihrer Login-ID und Ihrem persönlichen Passwort an." primary={["Schuldnerportal öffnen","/portal/login"]} title="Vorgang sicher aufrufen" />
  </PublicShell>;
}
