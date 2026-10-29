"use client";
import { useState } from "react";
import { type Data, money, num } from "@/lib/model";
import {
  localDate,
  weekRange,
  workerWeek,
  workerSchema,
  type Worker,
} from "@/lib/workers";
import { browserDb } from "@/lib/supabase";
import { ProgressAttachments } from "./progress-media";
import { ReviewStatus } from "./progress-review";
export function WorkersModule({
  data,
  demo,
  canManage,
  busy,
  persist,
  run,
}: {
  data: Data;
  demo: boolean;
  canManage: boolean;
  busy: boolean;
  persist: (d: Data) => void;
  run: (fn: () => Promise<void>) => Promise<void>;
}) {
  const [day, setDay] = useState(() => localDate()),
    [selected, setSelected] = useState(""),
    [creating, setCreating] = useState(false),
    [access, setAccess] = useState("");
  const workers = data.workers || [];
  const range = weekRange(day);
  const summaries = workers.map((worker) => ({
    worker,
    ...workerWeek(worker, data, day),
  }));
  const current = workers.find((w) => w.user_id === selected);
  const detail = current ? workerWeek(current, data, day) : null;
  const unmatched = data.reports.filter(
    (r) =>
      !workers.some((w) => w.user_id === r.author_id) &&
      (r.work_date || r.created_at.slice(0, 10)) >= range.start &&
      (r.work_date || r.created_at.slice(0, 10)) <= range.end,
  ).length;
  async function requestAccess(w: Worker) {
    if (demo) {
      setAccess(
        "En la demostración no se crean cuentas reales. Usa la sesión de tu equipo para generar el acceso.",
      );
      return;
    }
    const response = await fetch("/api/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "access", user_id: w.user_id }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setAccess(result.activation_url || result.warning);
  }
  return (
    <section className="workers-module">
      <div className="section-head">
        <label>
          Semana de pago
          <input
            type="date"
            value={day}
            required
            onChange={(e) => e.target.value && setDay(e.target.value)}
          />
        </label>
        <p>
          <strong>
            {range.start} — {range.end}
          </strong>
          <br />
          <span className="small muted">
            Lunes a domingo · USD · solo horas aprobadas
          </span>
        </p>
        {canManage && (
          <button
            className="button"
            onClick={() => {
              setCreating(!creating);
              setAccess("");
            }}
          >
            Nuevo trabajador
          </button>
        )}
      </div>
      {creating && canManage && (
        <form
          className="panel worker-create"
          onSubmit={(e) => {
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.currentTarget));
            void run(async () => {
              const input = workerSchema.parse(values);
              let worker: Worker;
              if (demo) {
                worker = {
                  user_id: crypto.randomUUID(),
                  full_name: input.full_name,
                  email: input.email,
                  phone: input.phone,
                  created_at: new Date().toISOString(),
                };
                if (workers.some((w) => w.email === worker.email))
                  throw new Error("Este correo ya está registrado.");
              } else {
                const response = await fetch("/api/workers", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(input),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                worker = result.worker;
                setAccess(result.activation_url || result.warning);
              }
              persist({
                ...data,
                workers: [...workers, worker],
                worker_rates: [
                  ...(data.worker_rates || []),
                  {
                    user_id: worker.user_id,
                    hourly_rate: input.hourly_rate,
                    effective_date: input.effective_date,
                  },
                ],
              });
              setCreating(false);
              setSelected(worker.user_id);
            });
          }}
        >
          <h2>Nuevo trabajador</h2>
          <div className="form-grid">
            <label>
              Nombre completo
              <input name="full_name" required minLength={2} maxLength={100} />
            </label>
            <label>
              Correo de acceso
              <input name="email" type="email" required />
            </label>
            <label>
              Teléfono (opcional)
              <input name="phone" maxLength={40} />
            </label>
            <label>
              Tarifa por hora (USD)
              <input
                name="hourly_rate"
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                required
              />
            </label>
            <label>
              Tarifa vigente desde
              <input
                name="effective_date"
                type="date"
                defaultValue={localDate()}
                required
              />
            </label>
          </div>
          <p className="small muted">
            Se crea una cuenta de trabajador. El enlace para elegir contraseña
            se muestra aquí para que lo compartas personalmente.
          </p>
          <button className="button" disabled={busy}>
            Crear trabajador y acceso
          </button>
        </form>
      )}
      {access && (
        <div className="panel worker-create">
          <h3>Acceso del trabajador</h3>
          <p className="small">
            Comparte este enlace únicamente con el trabajador. Permite elegir su
            contraseña y puede vencer.
          </p>
          <textarea
            aria-label="Enlace de acceso del trabajador"
            readOnly
            value={access}
          />
          <button className="text-link" onClick={() => setAccess("")}>
            Ocultar enlace
          </button>
        </div>
      )}
      <div className="stats">
        <article>
          <span>Horas aprobadas</span>
          <strong>{num(summaries.reduce((n, s) => n + s.approved, 0))}</strong>
        </article>
        <article>
          <span>Horas pendientes</span>
          <strong>{num(summaries.reduce((n, s) => n + s.pending, 0))}</strong>
        </article>
        <article>
          <span>Horas con observaciones</span>
          <strong>{num(summaries.reduce((n, s) => n + s.observed, 0))}</strong>
        </article>
        <article>
          <span>Pago base estimado</span>
          <strong>
            {summaries.some((s) => s.missing)
              ? "Incompleto"
              : money(summaries.reduce((n, s) => n + (s.amount || 0), 0))}
          </strong>
          <small>
            Sin impuestos, extras ni ajustes. No registra un pago realizado.
          </small>
        </article>
      </div>
      {unmatched > 0 && canManage && (
        <p className="notice">
          {unmatched} avances de esta semana no tienen un trabajador vinculado.
          No se asignan por coincidencia de nombre ni se incluyen en el pago.
        </p>
      )}
      <div className="panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>Obras asignadas</th>
              <th>Horas aprobadas</th>
              <th>Pendientes</th>
              <th>Con observaciones</th>
              <th>Pago estimado</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.worker.user_id}>
                <td>
                  <button
                    className="text-link"
                    onClick={() => setSelected(s.worker.user_id)}
                  >
                    {s.worker.full_name}
                  </button>
                  <small>{s.worker.email}</small>
                </td>
                <td>
                  {(data.assignments || [])
                    .filter((a) => a.user_id === s.worker.user_id)
                    .map(
                      (a) =>
                        data.projects.find((p) => p.id === a.project_id)?.name,
                    )
                    .filter(Boolean)
                    .join(", ") || "Sin asignar"}
                </td>
                <td>{num(s.approved)} h</td>
                <td>{num(s.pending)} h</td>
                <td>{num(s.observed)} h</td>
                <td>{s.amount === null ? "Falta tarifa" : money(s.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!workers.length && (
          <p className="empty-inline">No hay trabajadores registrados.</p>
        )}
      </div>
      {current && detail && (
        <section className="panel worker-detail">
          <div className="section-head">
            <h2>{current.full_name}</h2>
            {canManage && (
              <button
                className="text-link"
                disabled={busy}
                onClick={() => void run(() => requestAccess(current))}
              >
                Generar enlace de acceso
              </button>
            )}
          </div>
          <p>
            {current.email} {current.phone && `· ${current.phone}`}
          </p>
          <h3>Tarifas por hora</h3>
          <ul>
            {(data.worker_rates || [])
              .filter((r) => r.user_id === current.user_id)
              .sort((a, b) => b.effective_date.localeCompare(a.effective_date))
              .map((r) => (
                <li key={r.effective_date}>
                  {money(r.hourly_rate)} desde {r.effective_date}
                </li>
              ))}
          </ul>
          {canManage && (
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  const rate = workerSchema
                    .pick({ hourly_rate: true, effective_date: true })
                    .parse(Object.fromEntries(f));
                  if (
                    (data.worker_rates || []).some(
                      (r) =>
                        r.user_id === current.user_id &&
                        r.effective_date === rate.effective_date,
                    )
                  )
                    throw new Error(
                      "Ya hay una tarifa para esa fecha. Usa una nueva fecha de vigencia.",
                    );
                  const entry = { ...rate, user_id: current.user_id };
                  if (!demo) {
                    const result = await browserDb()
                      .from("worker_rates")
                      .insert(entry);
                    if (result.error)
                      throw new Error("No se pudo guardar la tarifa.");
                  }
                  persist({
                    ...data,
                    worker_rates: [...(data.worker_rates || []), entry],
                  });
                });
              }}
            >
              <label>
                Nueva tarifa por hora
                <input
                  name="hourly_rate"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="10000"
                  required
                />
              </label>
              <label>
                Vigente desde
                <input
                  name="effective_date"
                  type="date"
                  required
                  defaultValue={localDate()}
                />
              </label>
              <button className="button" disabled={busy}>
                Guardar tarifa
              </button>
            </form>
          )}
          <h3>Avances de la semana</h3>
          {!detail.lines.length && <p>No hay avances en esta semana.</p>}
          {detail.lines.map(({ report, rate, amount }) => (
            <article className="worker-report" key={report.id}>
              <strong>
                {data.projects.find((p) => p.id === report.project_id)?.name ||
                  "Obra"}
              </strong>
              <p>
                {report.work_date || report.created_at.slice(0, 10)} ·{" "}
                {num(report.hours)} h · {num(report.rolls)} rollos
              </p>
              <p>{report.notes || "Avance con archivos"}</p>
              <ProgressAttachments attachments={report.attachments} />
              <ReviewStatus report={report} />
              <p className="small muted">
                Tarifa aplicable:{" "}
                {rate ? money(rate.hourly_rate) : "Sin registrar"} · Importe
                aprobado: {amount === null ? "No calculado" : money(amount)}
              </p>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
