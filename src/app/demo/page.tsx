import { redirect } from "next/navigation";
import { Workspace } from "@/components/workspace";
export default function Demo() {
  // Keep isolated sample data available for local development and UI tests only.
  if (process.env.NODE_ENV === "production") redirect("/app");
  return <Workspace demo />;
}
