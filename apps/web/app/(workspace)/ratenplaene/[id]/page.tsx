import { InstallmentPlanDetail } from "@/components/installment-requests/installment-plan-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <InstallmentPlanDetail id={(await params).id} />; }
