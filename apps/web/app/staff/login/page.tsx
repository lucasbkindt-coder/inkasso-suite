import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { StaffLoginPage } from "@/components/staff-auth/staff-login-page";

const staffCookie = "payveo_staff_session";

export default async function StaffLoginRoute() {
  const token = (await cookies()).get(staffCookie)?.value;
  if (token) {
    const apiUrl = process.env.RISEPAY_API_INTERNAL_URL ?? "http://127.0.0.1:3001";
    const response = await fetch(`${apiUrl}/auth/session`, {
      cache: "no-store",
      headers: { cookie: `${staffCookie}=${token}` },
    }).catch(() => null);
    if (response?.ok) redirect("/");
  }
  return <StaffLoginPage />;
}
