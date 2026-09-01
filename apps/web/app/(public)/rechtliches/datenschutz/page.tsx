import { PageHero } from "@/components/public-site/public-elements";
import { PublicShell } from "@/components/public-site/public-shell";
import { publicMetadata } from "@/lib/public-metadata";

export const metadata = publicMetadata("Datenschutzinformation", "Vorbereitete Struktur der öffentlichen Datenschutzinformation von payveo.", "/rechtliches/datenschutz");

const sections = [
  ["Verantwortlicher", "Die verbindliche Firmierung, Anschrift und Erreichbarkeit des Verantwortlichen werden vor Produktivschaltung aus bestätigten Unternehmensangaben ergänzt."],
  ["Hosting und Serverprotokolle", "Zu dokumentieren sind Hostinganbieter, Standort, technische Protokolldaten, Zweck, Rechtsgrundlage und konkrete Speicherdauer."],
  ["Kontaktaufnahme", "Vor Einführung eines öffentlichen Kontaktformulars sind Umfang, Zweck, Rechtsgrundlage, Empfänger und Löschfristen der Kontaktdaten festzulegen."],
  ["Portalnutzung", "Für Mandanten- und Schuldnerportal ist eine gesonderte Beschreibung der Anmeldung, Sitzungen, Sicherheitsprotokolle und verarbeiteten Vorgangsdaten erforderlich."],
  ["Cookies", "Die Corporate Website setzt in P1 keine Analyse- oder Marketingcookies. Technisch notwendige Authentifizierungscookies der geschützten Portale sind gesondert zu erläutern."],
  ["Betroffenenrechte", "Die Endfassung muss Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Beschwerdemöglichkeiten rechtlich geprüft darstellen."],
] as const;

export default function PublicPrivacyPage(){return <PublicShell><PageHero description="Struktur der öffentlichen Datenschutzinformation für die Corporate Website und die geschützten Portalzugänge." eyebrow="Rechtliches" title="Datenschutzinformation" /><section className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:py-20"><div className="border-l-4 border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-700">Verantwortliche Stelle, Dienstleister, Rechtsgrundlagen und konkrete Speicherfristen werden vor Veröffentlichung verbindlich bestätigt.</div><div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">{sections.map(([title,text])=><section className="py-8" key={title}><h2 className="text-xl font-semibold">{title}</h2><p className="mt-3 leading-7 text-slate-600">{text}</p></section>)}</div></section></PublicShell>}
