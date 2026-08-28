"use client";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import * as React from "react";
import { formatCurrency, formatDate } from "@/components/cases/case-ui";
import { ClientPortalNavigation } from "./client-portal-navigation";
import { PortalDownloadButton } from "./portal-download-button";
import { portalAuthApi } from "@/lib/portal-auth-api";
import { portalClientApi } from "@/lib/portal-client-api";
import { installmentRequestStatusLabels, type InstallmentRequest } from "@/types/installment-request";
import { installmentPlanItemStatusLabels, installmentPlanStatusLabels, type InstallmentPlan } from "@/types/installment-plan";
type Data = Record<string, unknown>;
function usePreviewToken() {
  const params = useSearchParams();
  const previewFromRouter = params.get("preview");
  const [state, setState] = React.useState({ ready: false, token: "" });
  React.useEffect(() => {
    const token =
      previewFromRouter ??
      new URLSearchParams(window.location.search).get("preview") ??
      "";
    setState({ ready: true, token });
  }, [previewFromRouter]);
  return state;
}
async function request(path: string, token?: string) {
  const r = await fetch(`/api${path}`, {
    credentials: "include",
    headers: token
      ? {
          "x-risepay-portal-preview": token,
          ...(process.env.NODE_ENV !== "production" ? { "x-payveo-preview-debug": "browser" } : {}),
        }
      : undefined,
    cache: "no-store",
  });
  if (!r.ok)
    throw new Error(
      r.status === 401
        ? token
          ? "Die interne Portalvorschau konnte nicht geladen werden. Bitte öffnen Sie die Vorschau erneut aus payveo."
          : "Bitte melden Sie sich für den Portalzugang an."
        : "Diese Portalansicht ist nicht verfügbar.",
    );
  return r.json() as Promise<Data>;
}
export function PortalLayout({
  type,
  children,
}: {
  type: "Mandantenportal" | "Schuldnerportal";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { ready, token } = usePreviewToken();
  const [session, setSession] = React.useState<import("@/lib/portal-auth-api").PortalSession | null>(null);
  const [returnUrl, setReturnUrl] = React.useState("/");
  React.useEffect(() => {
    if (!ready) return;
    if (token)
      void request("/portal/context", token)
        .then((value) => setReturnUrl(String(value.returnUrl)))
        .catch(() => undefined);
    else void portalAuthApi.getPortalSession().then(setSession).catch(() => setSession(null));
  }, [ready, token]);
  const back = type === "Mandantenportal" ? "Ansicht als Mandant" : "Ansicht als Schuldner";
  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <Link
            className="font-semibold"
            href={`/portal/${type === "Mandantenportal" ? "mandant" : "schuldner"}${token ? `?preview=${token}` : ""}`}
          >
            payveo · {type}
          </Link>
        </div>
      </header>
      {token ? <div className="border-b border-amber-500/30 bg-amber-500/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 p-3 text-sm">
          <span>
            <strong>Interne Portalvorschau</strong> – {back}
          </span>
          <Link
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            href={returnUrl}
          >
            {" "}
            <ArrowLeft className="size-4" /> Zurück zu payveo
          </Link>
        </div>
      </div> : session ? <AuthenticatedHeader session={session} /> : null}
      {type === "Mandantenportal" ? (
        <ClientPortalNavigation pathname={pathname} token={token} />
      ) : null}
      <div className="mx-auto max-w-6xl p-4 sm:p-8">{children}</div>
    </main>
  );
}
function usePortal(path: string) {
  const { ready, token } = usePreviewToken();
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!ready) return;
    setError("");
    void request(path, token)
      .then(setData)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Portalansicht konnte nicht geladen werden."),
      );
  }, [path, ready, token]);
  return { data, error, token, ready };
}
export function ClientPortal({ view }: { view: "summary" | "cases" | "detail" }) {
  const params = useParams<{ id: string }>();
  const path =
    view === "summary"
      ? "/portal/client/summary"
      : view === "cases"
        ? "/portal/client/cases"
        : `/portal/client/cases/${params.id}`;
  const { data, error, token } = usePortal(path);
  return (
    <PortalLayout type="Mandantenportal">
      {error ? (
        <p className="text-destructive">{error}</p>
      ) : !data ? (
        <p className="text-muted-foreground">Portal wird geladen …</p>
      ) : view === "summary" ? (
        <>
          <h1 className="text-3xl font-semibold">{String(data.clientName)}</h1>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ["Inkassoakten", data.total],
              ["Laufend", data.open],
              ["Hauptforderungen", formatCurrency(String(data.principalTotal), "EUR")],
            ].map(([l, v]) => (
              <article className="rounded-xl border bg-card p-5" key={String(l)}>
                <p className="text-sm text-muted-foreground">{String(l)}</p>
                <p className="mt-2 text-2xl font-semibold">{String(v)}</p>
              </article>
            ))}
          </div>
          <Link
            className="mt-6 inline-block text-primary hover:underline"
            href={`/portal/mandant/akten${token ? `?preview=${token}` : ""}`}
          >
            Inkassoakten anzeigen
          </Link>
        </>
      ) : view === "cases" ? (
        <Cases items={data as unknown as Data[]} token={token} />
      ) : (
        <CaseDetail data={data} token={token} />
      )}
    </PortalLayout>
  );
}
function Cases({ items, token }: { items: Data[]; token: string }) {
  return (
    <>
      <h1 className="text-3xl font-semibold">Inkassoakten</h1>
      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <Link
            className="block rounded-xl border bg-card p-4 hover:bg-muted/40"
            href={`/portal/mandant/akten/${item.id}${token ? `?preview=${token}` : ""}`}
            key={String(item.id)}
          >
            <p className="font-medium">
              {String(item.caseNumber)} · {String((item.debtorParty as Data).displayName)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Rechnung: {String((item.claim as Data | null)?.invoiceNumber ?? "—")} ·{" "}
              {formatCurrency(
                String((item.claim as Data | null)?.principalAmount ?? "0"),
                String((item.claim as Data | null)?.currency ?? "EUR"),
              )}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
function CaseDetail({ data, token }: { data: Data; token: string }) {
  const claim = data.claim as Data | null;
  const ledger = data.ledger as Data;
  const documents = data.documents as Data[];
  return (
    <>
      <h1 className="text-3xl font-semibold">{String(data.caseNumber)}</h1>
      <dl className="mt-6 grid gap-3 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <dt>Schuldner</dt>
        <dd>{String((data.debtorParty as Data).displayName)}</dd>
        <dt>Rechnungsnummer</dt>
        <dd>{String(claim?.invoiceNumber ?? "—")}</dd>
        <dt>Hauptforderung</dt>
        <dd>
          {formatCurrency(String(claim?.principalAmount ?? "0"), String(claim?.currency ?? "EUR"))}
        </dd>
        <dt>Offener Betrag</dt>
        <dd>{formatCurrency(String(ledger.totalOpen), "EUR")}</dd>
      </dl>
      <h2 className="mt-6 text-xl font-semibold">Freigegebene Dokumente</h2>
      {documents.length ? (
        <div className="mt-3 space-y-2">
          {documents.map((d) => (
            <p className="rounded-lg border p-3" key={String(d.id)}>
              {String(d.filename)}
              <PortalDownloadButton id={String(d.id)} token={token} />
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Keine Dokumente freigegeben.</p>
      )}
    </>
  );
}
export function DebtorPortal({ view }: { view: "summary" | "claim" | "documents" | "detail" }) {
  const params = useParams<{ id: string }>();
  const path =
    view === "summary"
      ? "/portal/debtor/summary"
      : view === "claim"
        ? "/portal/debtor/claim"
        : view === "documents"
          ? "/portal/debtor/documents"
          : `/portal/debtor/cases/${params.id}`;
  const { data, error, token } = usePortal(path);
  return (
    <PortalLayout type="Schuldnerportal">
      {error ? (
        <p className="text-destructive">{error}</p>
      ) : !data ? (
        <p className="text-muted-foreground">Portal wird geladen …</p>
      ) : view === "documents" ? (
        <>
          <h1 className="text-2xl font-semibold">Dokumente</h1>
          {(data as unknown as Data[]).length ? (
            <div className="mt-4 space-y-3">
              {(data as unknown as Data[]).map((d) => (
                <article className="rounded-xl border bg-card p-4" key={String(d.documentId)}>
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <p className="font-medium"><FileText className="mr-2 inline size-4" />{String(d.documentName)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Aktenzeichen: {String(d.caseNumber)} · {formatDate(String(d.documentDate ?? d.createdAt))}
                      </p>
                    </div>
                    <PortalDownloadButton id={String(d.documentId)} token={token} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Derzeit sind keine Dokumente für Sie hinterlegt.</p>
          )}
        </>
      ) : view === "summary" ? (
        <DebtorOverview data={data} token={token} />
      ) : (
        <DebtorData data={data} token={token} />
      )}
    </PortalLayout>
  );
}
function DebtorOverview({ data, token }: { data: Data; token: string }) {
  const cases = (data.cases ?? []) as Data[];
  return <><h1 className="text-3xl font-semibold">Willkommen, {String(data.debtorName ?? "")}</h1><div className="mt-6 grid gap-4 sm:grid-cols-2"><article className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Offene Gesamtforderung</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(String(data.totalOpen ?? "0"), "EUR")}</p></article><article className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Laufende Akten</p><p className="mt-2 text-2xl font-semibold">{String(data.activeCaseCount ?? 0)}</p></article></div><h2 className="mt-8 text-xl font-semibold">Ihre Inkassoakten</h2><div className="mt-3 space-y-3">{cases.map((item) => <Link className="block rounded-xl border bg-card p-4 hover:bg-muted/40" href={`/portal/schuldner/akten/${String(item.id)}${token ? `?preview=${token}` : ""}`} key={String(item.id)}><p className="font-medium">{String(item.caseNumber)} · {String((item.clientParty as Data).displayName)}</p><p className="mt-1 text-sm text-muted-foreground">Hauptforderung: {formatCurrency(String(item.principalAmount ?? "0"), String(item.currency ?? "EUR"))} · Offen: {formatCurrency(String(item.openAmount ?? "0"), String(item.currency ?? "EUR"))}</p></Link>)}</div></>;
}
function DebtorData({ data, token }: { data: Data; token: string }) {
  const ledger = (data.ledger ?? data) as Data;
  const payment = data.paymentInformation as Data | null;
  return (
    <>
      <h1 className="text-3xl font-semibold">Ihre Forderung</h1>
      {data.caseNumber ? (
        <p className="mt-2 text-muted-foreground">
          Aktenzeichen: {String(data.caseNumber)} · Auftraggeber:{" "}
          {String(data.clientName ?? "payveo")}
        </p>
      ) : null}
      <div className="mt-6 space-y-3 rounded-xl border bg-card p-5">
        {[
          ["Hauptforderung", ledger.openPrincipal],
          ["Kosten", ledger.openCosts],
          ["Zinsen", ledger.openInterest],
          ["Offener Gesamtbetrag", ledger.totalOpen],
          ["Bisherige Zahlungen", ledger.payments],
          ["Nicht zugeordnetes Guthaben", ledger.unallocatedPayments],
        ].map(([l, v]) => (
          <div className="flex justify-between gap-4" key={String(l)}>
            <span>{String(l)}</span>
            <strong>{formatCurrency(String(v), "EUR")}</strong>
          </div>
        ))}
      </div>
      {payment ? (
        <div className="mt-6 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Zahlungsinformationen</h2>
          <p className="mt-3">
            {String(payment.recipient)} · IBAN: {String(payment.iban)} · BIC:{" "}
            {String(payment.bic ?? "—")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Verwendungszweck: {String(payment.reference)}
          </p>
        </div>
      ) : null}
      <div className="mt-6 flex gap-4">
        <Link
          className="text-primary hover:underline"
          href={`/portal/schuldner/forderung${token ? `?preview=${token}` : ""}`}
        >
          Forderungsübersicht
        </Link>
        <Link
          className="text-primary hover:underline"
          href={`/portal/schuldner/dokumente${token ? `?preview=${token}` : ""}`}
        >
          Dokumente
        </Link>
      </div>
      {data.id ? <InstallmentSection caseId={String(data.id)} openAmount={String(ledger.totalOpen)} previewToken={token} requests={(data.installmentRequests ?? []) as InstallmentRequest[]} /> : null}
    </>
  );
}
function InstallmentSection({caseId,openAmount,previewToken,requests}:{caseId:string;openAmount:string;previewToken:string;requests:InstallmentRequest[]}) {
 const [items,setItems]=React.useState(requests); const [plan,setPlan]=React.useState<InstallmentPlan|null>(null); const [open,setOpen]=React.useState(false); const [review,setReview]=React.useState(false); const [amount,setAmount]=React.useState(""); const [start,setStart]=React.useState(""); const [count,setCount]=React.useState(""); const [message,setMessage]=React.useState(""); const [error,setError]=React.useState(""); const [pending,setPending]=React.useState(false);
 React.useEffect(()=>{void portalClientApi.getInstallmentPlan(caseId,previewToken).then(setPlan).catch(()=>setPlan(null));},[caseId,previewToken]);
 const active=items.find((item)=>item.status==="SUBMITTED"||item.status==="UNDER_REVIEW");
 const submit=async()=>{if(previewToken){setError("Im Vorschaumodus können keine Ratenzahlungsanfragen abgesendet werden.");return;}setPending(true);setError("");try{const item=await portalClientApi.createInstallmentRequest(caseId,{requestedMonthlyAmount:amount,preferredStartDate:start,numberOfInstallments:count?Number(count):undefined,debtorMessage:message||undefined});setItems([item,...items]);setOpen(false);setReview(false)}catch(cause){setError(cause instanceof Error&&cause.message.includes("bereits")?"Für diese Akte liegt bereits eine offene Ratenzahlungsanfrage vor.":"Die Anfrage konnte nicht abgesendet werden.")}finally{setPending(false)}};
 const check=(e:React.FormEvent)=>{e.preventDefault();if(!/^\d+(\.\d{1,2})?$/.test(amount)||Number(amount)<=0){setError("Bitte geben Sie eine monatliche Rate größer als 0 ein.");return}if(!start){setError("Bitte geben Sie einen Starttermin an.");return}if(count&&!/^[1-9]\d*$/.test(count)){setError("Die Ratenanzahl muss eine positive ganze Zahl sein.");return}setError("");setReview(true)};
 return <section className="mt-8 rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Ratenzahlung</h2>{plan?<div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm"><strong>Ratenplan: {installmentPlanStatusLabels[plan.status]}</strong><p>Vereinbarter Betrag: {formatCurrency(plan.initialOpenAmount,"EUR")} · Rate: {formatCurrency(plan.plannedInstallmentAmount,"EUR")}</p>{plan.nextItem?<p>Nächste Rate: {formatCurrency(plan.nextItem.remainingAmount,"EUR")} am {formatDate(plan.nextItem.dueDate)} · {installmentPlanItemStatusLabels[plan.nextItem.status]}</p>:null}<p className="mt-2 text-muted-foreground">Weitere Zinsen oder Kosten können die aktuelle offene Gesamtforderung verändern.</p></div>:null}{items.map(item=><div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm" key={item.id}><strong>{installmentRequestStatusLabels[item.status]}</strong><p>Gewünschte Rate: {formatCurrency(item.requestedMonthlyAmount,"EUR")} · Start: {formatDate(item.preferredStartDate)}</p></div>)}{!plan&&active?null:!plan&&!open?<><button className="mt-4 rounded-lg bg-primary px-3 py-2 text-primary-foreground" onClick={()=>setOpen(true)} type="button">Ratenzahlung anfragen</button>{previewToken?<p className="mt-2 text-sm text-muted-foreground">Im Vorschaumodus können keine Ratenzahlungsanfragen abgesendet werden.</p>:null}</>:!plan&&review?<div className="mt-4 space-y-3 rounded-lg border p-4"><h3 className="font-semibold">Zusammenfassung Ihrer Anfrage</h3><p>Aktuell offener Betrag: {formatCurrency(openAmount,"EUR")}</p><button className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={pending||Boolean(previewToken)} onClick={()=>void submit()} type="button">{pending?"Wird gesendet …":"Anfrage verbindlich absenden"}</button></div>:!plan?<form className="mt-4 space-y-3" onSubmit={check}><label className="block text-sm">Gewünschte monatliche Rate<input className="mt-1 w-full rounded border p-2" onChange={e=>setAmount(e.target.value)} required value={amount}/></label><label className="block text-sm">Gewünschter Starttermin<input className="mt-1 w-full rounded border p-2" onChange={e=>setStart(e.target.value)} required type="date" value={start}/></label><button className="rounded-lg bg-primary px-3 py-2 text-primary-foreground" type="submit">Anfrage prüfen</button></form>:null}</section>
}
function AuthenticatedHeader({ session }: { session: import("@/lib/portal-auth-api").PortalSession }) {
  const [pending, setPending] = React.useState(false);
  const logout = async () => { setPending(true); try { await portalAuthApi.logoutPortal(); window.location.assign("/portal/login"); } catch { setPending(false); } };
  return <div className="border-b bg-muted/30"><div className="mx-auto flex max-w-6xl items-center justify-between p-3 text-sm"><span>{session.portalType === "CLIENT" && session.clientContactName ? `Angemeldet als ${session.clientContactName}` : "Angemeldeter Portalzugang"}</span><button className="font-medium text-primary hover:underline disabled:opacity-60" disabled={pending} onClick={() => void logout()} type="button">Abmelden</button></div></div>;
}
