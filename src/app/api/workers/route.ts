import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { serverDb } from "@/lib/server";
import { workerSchema } from "@/lib/workers";
import { z } from "zod";
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return reply({ error: "Solicitud no permitida." }, 403);
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return reply({ error: "Inicia sesión." }, 401);
  const member = await db
    .from("memberships")
    .select("role,active")
    .eq("user_id", user.id)
    .single();
  if (!member.data?.active || !["owner", "office"].includes(member.data.role))
    return reply(
      { error: "Solo oficina puede administrar trabajadores." },
      403,
    );
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret)
    return reply(
      { error: "La creación de accesos aún no está configurada." },
      503,
    );
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return reply({ error: "Datos inválidos." }, 400);
  }
  let worker;
  if (body.action === "access") {
    const parsed = z.string().uuid().safeParse(body.user_id);
    if (!parsed.success) return reply({ error: "Trabajador inválido." }, 400);
    const found = await db
      .from("workers")
      .select("*")
      .eq("user_id", parsed.data)
      .single();
    if (found.error || !found.data)
      return reply({ error: "Trabajador no disponible." }, 404);
    const membership = await admin
      .from("memberships")
      .select("role,active")
      .eq("user_id", parsed.data)
      .single();
    if (
      !membership.data?.active ||
      !["worker", "crew_lead"].includes(membership.data.role)
    )
      return reply({ error: "Esta cuenta no es un trabajador activo." }, 403);
    worker = found.data;
  } else {
    const parsed = workerSchema.safeParse(body);
    if (!parsed.success)
      return reply({ error: "Revisa nombre, correo, tarifa y fecha." }, 400);
    const input = parsed.data;
    const created = await admin.auth.admin.createUser({
      email: input.email,
      password: randomBytes(32).toString("base64url"),
      email_confirm: true,
      user_metadata: { full_name: input.full_name },
    });
    if (created.error || !created.data.user)
      return reply(
        {
          error:
            "No se pudo crear la cuenta. Verifica si ese correo ya está registrado.",
        },
        409,
      );
    const result = await admin.rpc("provision_worker", {
      p_user_id: created.data.user.id,
      p_name: input.full_name,
      p_email: input.email,
      p_phone: input.phone,
      p_rate: input.hourly_rate,
      p_effective: input.effective_date,
    });
    if (result.error) {
      await admin.auth.admin.deleteUser(created.data.user.id);
      return reply(
        { error: "No se pudo guardar el trabajador. Intenta nuevamente." },
        400,
      );
    }
    worker = result.data;
  }
  // Generate a link without sending email. Never accept a client-supplied role or redirect URL.
  const link = await admin.auth.admin.generateLink({
    type: "recovery",
    email: worker.email,
  });
  return reply({
    worker,
    activation_url: link.data?.properties?.hashed_token
      ? `${origin}/activate#token_hash=${link.data.properties.hashed_token}&type=recovery`
      : null,
    warning: link.error
      ? "Trabajador guardado. Genera de nuevo su enlace de acceso."
      : null,
  });
}
