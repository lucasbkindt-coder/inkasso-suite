"use client";
import Link from "next/link";
import * as React from "react";
import { caseApi } from "./case-api";
import { formatCurrency, formatDate } from "./case-ui";
import { installmentPlanStatusLabels, type InstallmentPlan } from "@/types/installment-plan";

export function CaseInstallmentPlan({ caseId }: { caseId: string }) { const [plans,setPlans]=React.useState<InstallmentPlan[]>([]); React.useEffect(()=>{void caseApi.getInstallmentPlans().then(setPlans).catch(()=>setPlans([]));},[]); const plan=plans.find(item=>item.case?.id===caseId); if(!plan)return null; return <section className="rounded-2xl border bg-card p-6 shadow-sm"><h2 className="text-xl font-semibold">Ratenplan</h2><p className="mt-2 text-sm text-muted-foreground">{installmentPlanStatusLabels[plan.status]} · nächste Rate: {plan.nextItem?`${formatCurrency(plan.nextItem.remainingAmount,"EUR")} am ${formatDate(plan.nextItem.dueDate)}`:"keine offene Rate"}</p><Link className="mt-3 inline-block text-sm text-primary hover:underline" href={`/ratenplaene/${plan.id}`}>Ratenplan öffnen</Link></section>; }
