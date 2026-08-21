import { InstallmentRequestsClient } from "@/components/installment-requests/installment-requests-client";
export default async function Page({params}:{params:Promise<{id:string}>}){return <InstallmentRequestsClient id={(await params).id}/>}
