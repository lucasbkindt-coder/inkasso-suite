"use client";

import { Loader2, Phone } from "lucide-react";
import * as React from "react";

import { staffAuthApi } from "@/lib/staff-auth-api";
import { Button } from "@/components/ui/button";

type CallResponse = { id: string };

export function DeskCallButton({ number, partyId, caseId }: { number?: string | null; partyId: string; caseId?: string }) {
  const [visible,setVisible]=React.useState(false);
  const [pending,setPending]=React.useState(false);
  const [error,setError]=React.useState("");
  React.useEffect(()=>{void staffAuthApi.session().then((session)=>setVisible(session.permissions.includes("desk:telephony:use"))).catch(()=>setVisible(false));},[]);
  if(!visible||!number)return null;
  async function call(){setPending(true);setError("");try{const response=await fetch("/api/desk/telephony/calls/outgoing",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({remoteNumber:number,partyId,caseId})});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(Array.isArray(body.message)?body.message.join(" "):body.message||"Anruf konnte nicht gestartet werden.");const configResponse=await fetch("/api/desk/config",{credentials:"include"});const config=await configResponse.json() as {publicBaseUrl:string};window.open(`${config.publicBaseUrl.replace(/\/$/,"")}/calls/${(body as CallResponse).id}`,"_blank","noopener,noreferrer");}catch(cause){setError(cause instanceof Error?cause.message:"Anruf konnte nicht gestartet werden.");}finally{setPending(false);}}
  return <span className="inline-flex flex-col items-start"><Button disabled={pending} onClick={()=>void call()} variant="outline">{pending?<Loader2 className="size-4 animate-spin"/>:<Phone className="size-4"/>}{number} anrufen</Button>{error?<span className="mt-1 max-w-64 text-xs text-destructive">{error}</span>:null}</span>;
}
