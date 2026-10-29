import { redirect } from "next/navigation";
import { serverDb } from "@/lib/server";
import { configured } from "@/lib/supabase";
import { Workspace } from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function App() {
  if (!configured()) redirect("/login");
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  return <Workspace userId={user.id} />;
}
