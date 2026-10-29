"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { browserDb, configured } from "@/lib/supabase";
export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-page" id="main">
      <Link href="/">
        <Brand />
      </Link>
      <section className="login-card">
        <p className="eyebrow">TU ESPACIO DE TRABAJO</p>
        <h1>Bienvenido de vuelta.</h1>
        <p className="muted">Entra con la cuenta asignada a tu equipo.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const f = new FormData(e.currentTarget);
              const { error } = await browserDb().auth.signInWithPassword({
                email: String(f.get("email")),
                password: String(f.get("password")),
              });
              if (error)
                throw new Error(
                  "No pudimos entrar. Revisa tu correo y contraseña.",
                );
              router.replace("/app");
                  router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo conectar.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Correo electrónico
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              minLength={8}
            />
          </label>
          {!configured() && (
            <p className="notice">
              El acceso del equipo estará disponible al conectar la base de
              datos. Puedes revisar la demostración.
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy || !configured()}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <Link className="text-link" href="/demo">
          Ver demostración con datos de ejemplo →
        </Link>
        <p className="small muted">
          Para obtener o recuperar acceso, contacta al administrador de Quality
          Housewrap.
        </p>
      </section>
    </main>
  );
}
