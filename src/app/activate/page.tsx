"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { browserDb, configured } from "@/lib/supabase";

export default function Activate() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="login-page" id="main">
      <Link href="/">
        <Brand />
      </Link>
      <section className="login-card">
        <p className="eyebrow">TU ACCESO AL EQUIPO</p>
        <h1>Elige tu contraseña.</h1>
        <p className="muted">
          Activa tu cuenta para entrar al espacio de Quality Housewrap.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const form = new FormData(event.currentTarget);
            const password = String(form.get("password"));
            if (password.length < 12 || password.length > 128) {
              setError("Usa una contraseña de entre 12 y 128 caracteres.");
              return;
            }
            if (password !== form.get("confirmation")) {
              setError("Las contraseñas no coinciden. Revisa ambas.");
              return;
            }
            setBusy(true);
            try {
              const db = browserDb();
              // Fragments stay in the browser, outside server logs and referrers.
              // Verification happens only on explicit submission, never on GET.
              const token = new URLSearchParams(
                window.location.hash.slice(1),
              ).get("token_hash");
              if (token) {
                const result = await db.auth.verifyOtp({
                  token_hash: token,
                  type: "invite",
                });
                if (result.error)
                  throw new Error(
                    "Este enlace venció o ya fue utilizado. Solicita un nuevo enlace de activación.",
                  );
                window.history.replaceState(null, "", "/activate");
              }
              const {
                data: { user },
                error: userError,
              } = await db.auth.getUser();
              if (userError || !user)
                throw new Error(
                  "Abre el enlace de activación que recibiste para establecer tu contraseña.",
                );
              const { error: passwordError } = await db.auth.updateUser({
                password,
              });
              if (passwordError)
                throw new Error(
                  "No pudimos guardar esa contraseña. Prueba una contraseña más larga y distinta.",
                );
              router.replace("/app");
              router.refresh();
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "No se pudo activar la cuenta. Vuelve a intentar.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Nueva contraseña
            <input
              autoFocus
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <label>
            Repite la contraseña
            <input
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <p className="small muted">
            Usa al menos 12 caracteres. Guarda tu contraseña en un lugar seguro.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy || !configured()}>
            {busy ? "Activando…" : "Activar cuenta y entrar"}
          </button>
        </form>
        <Link className="text-link" href="/login">
          Ya tengo contraseña →
        </Link>
      </section>
    </main>
  );
}
