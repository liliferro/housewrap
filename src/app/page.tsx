import { redirect } from "next/navigation";
import { serverDb } from "@/lib/server";
import { configured } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export default async function Home() {
  if (configured()) {
    const db = await serverDb();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (user) redirect("/app");
  }
  redirect("/demo");
}
