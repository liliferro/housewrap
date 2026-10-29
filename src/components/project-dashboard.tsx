"use client";
import { useState } from "react";
import {
  type Data,
  type Project,
  type Estimate,
  money,
  num,
} from "@/lib/model";

export function projectMetrics(project: Project, data: Data, now = Date.now()) {
  const reports = data.reports.filter((r) => r.project_id === project.id);
  const estimates = data.estimates.filter((e) => e.project_id === project.id);
  const quote = estimates.find(
    (e) => e.id === project.quoted_estimate_id && e.status === "approved",
  );
  const rolls = reports.reduce((n, r) => n + Number(r.rolls), 0);
  const hours = reports.reduce((n, r) => n + Number(r.hours), 0);
  const elapsed = project.started_at
    ? Math.max(
        0,
        ((project.finished_at ? Date.parse(project.finished_at) : now) -
          Date.parse(project.started_at)) /
          3600000,
      )
    : null;
  return { reports, estimates, quote, rolls, hours, elapsed };
}
function localInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
const date = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString("es", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Sin registrar";
export function ProjectDashboard({
  project,
  data,
  canManage,
  busy,
  save,
  exportEstimate,
  children,
}: {
  project: Project;
  data: Data;
  canManage: boolean;
  busy: boolean;
  save: (p: Partial<Project>) => Promise<void>;
  exportEstimate: (e: Estimate) => void;
  children: React.ReactNode;
}) {
  const [error, setError] = useState("");
  const m = projectMetrics(project, data);
  return (
    <div className="project-dashboard">
      <p className="eyebrow">DASHBOARD DE OBRA</p>
      <div className="stats project-stats">
        <article>
          <span>Presupuesto cotizado</span>
          <strong>
            {canManage
              ? m.quote
                ? money(Number(m.quote.total))
                : "Por definir"
              : "Restringido"}
          </strong>
          <small>
            {m.quote
              ? "Referencia seleccionada · USD"
              : "Selecciona un estimado aprobado"}
          </small>
        </article>
        <article>
          <span>Avance de obra</span>
          <strong>{project.progress || 0}%</strong>
          <progress
            max={100}
            value={project.progress || 0}
            aria-label="Avance de obra"
          />
          <small>Avance declarado por oficina</small>
        </article>
        <article>
          <span>Rollos usados</span>
          <strong>{num(m.rolls)}</strong>
          <small>
            {canManage
              ? "Reportados · pendientes de revisión"
              : "Tus reportes visibles"}
            {m.quote ? ` · ${num(m.quote.rolls)} previstos` : ""}
          </small>
        </article>
        <article>
          <span>Horas reportadas</span>
          <strong>{num(m.hours)} h</strong>
          <small>
            {canManage
              ? "Suma de horas de trabajadores"
              : "Tus reportes visibles"}{" "}
            · no es nómina
          </small>
        </article>
      </div>
      <div className="project-dashboard-grid">
        <section className="panel dashboard-panel">
          <h3>Calendario y avances</h3>
          <dl>
            <dt>Inicio real</dt>
            <dd>{date(project.started_at)}</dd>
            <dt>Finalización real</dt>
            <dd>{date(project.finished_at)}</dd>
            <dt>Tiempo transcurrido</dt>
            <dd>
              {m.elapsed === null
                ? "Sin inicio registrado"
                : `${num(m.elapsed)} h de calendario`}
            </dd>
            <dt>Fecha objetivo</dt>
            <dd>{project.target_date || "Por definir"}</dd>
          </dl>
          <p className="report-notes">
            {project.progress_notes || "Sin observaciones de avance."}
          </p>
          {canManage && (
            <details>
              <summary>Actualizar avance y fechas</summary>
              <form
                key={`${project.progress}-${project.started_at}-${project.finished_at}`}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError("");
                  const f = new FormData(e.currentTarget);
                  const started = String(f.get("started_at") || "");
                  const finished = String(f.get("finished_at") || "");
                  if (
                    finished &&
                    (!started || new Date(finished) < new Date(started))
                  ) {
                    setError("La finalización debe ser posterior al inicio.");
                    return;
                  }
                  try {
                    await save({
                      progress: Number(f.get("progress")),
                      progress_notes: String(
                        f.get("progress_notes") || "",
                      ).trim(),
                      started_at: started
                        ? new Date(started).toISOString()
                        : null,
                      finished_at: finished
                        ? new Date(finished).toISOString()
                        : null,
                      target_date: String(f.get("target_date") || "") || null,
                    });
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "No se pudo guardar.",
                    );
                  }
                }}
              >
                <label>
                  Avance (%)
                  <input
                    name="progress"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    required
                    defaultValue={project.progress || 0}
                  />
                </label>
                <label>
                  Observaciones de avance
                  <textarea
                    name="progress_notes"
                    maxLength={2000}
                    defaultValue={project.progress_notes || ""}
                  />
                </label>
                <label>
                  Fecha y hora de inicio
                  <input
                    type="datetime-local"
                    name="started_at"
                    defaultValue={localInput(project.started_at)}
                  />
                </label>
                <label>
                  Fecha y hora de finalización
                  <input
                    type="datetime-local"
                    name="finished_at"
                    defaultValue={localInput(project.finished_at)}
                  />
                </label>
                <label>
                  Fecha objetivo
                  <input
                    type="date"
                    name="target_date"
                    defaultValue={project.target_date || ""}
                  />
                </label>
                <p className="small muted">
                  Fechas y horas en la zona horaria de este dispositivo. El
                  tiempo transcurrido incluye noches y descansos.
                </p>
                <button className="button primary" disabled={busy}>
                  Guardar avance
                </button>
              </form>
            </details>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </section>
        <section className="panel dashboard-panel">
          <h3>Contactos y datos de la obra</h3>
          {children}
        </section>
      </div>
      {canManage && (
        <section className="panel dashboard-panel">
          <h3>Presupuesto y estimados</h3>
          <label>
            Presupuesto cotizado de esta obra
            <select
              value={project.quoted_estimate_id || ""}
              disabled={busy}
              onChange={async (e) => {
                setError("");
                try {
                  await save({ quoted_estimate_id: e.target.value || null });
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "No se pudo guardar.",
                  );
                }
              }}
            >
              <option value="">Sin cotización registrada</option>
              {m.estimates
                .filter((e) => e.status === "approved")
                .map((e) => (
                  <option value={e.id} key={e.id}>
                    {money(Number(e.total))} · {date(e.created_at)} ·{" "}
                    {e.id.slice(0, 8)}
                  </option>
                ))}
            </select>
          </label>
          <p className="muted small">
            Selecciona el estimado aprobado que usaste para cotizar. Este
            registro no envía la cotización ni confirma la aceptación del
            builder. Las versiones no se suman.
          </p>
          {m.quote && (
            <p>
              Material previsto: <b>{num(m.quote.rolls)} rollos</b> · Diferencia
              frente a lo reportado:{" "}
              <b>{num(m.rolls - Number(m.quote.rolls))} rollos</b>.
            </p>
          )}
          {!m.estimates.length ? (
            <p>Esta obra todavía no tiene estimados.</p>
          ) : (
            <div className="estimate-history">
              {m.estimates.map((e) => (
                <article key={e.id}>
                  <strong>{money(Number(e.total))}</strong>
                  <span>
                    {e.status === "approved"
                      ? "Aprobado internamente"
                      : "Borrador"}{" "}
                    · {date(e.created_at)}
                  </span>
                  <span>
                    {num(e.area)} ft² · {num(e.rolls)} rollos previstos
                  </span>
                  <button
                    className="text-link"
                    onClick={() => exportEstimate(e)}
                  >
                    Descargar estimado
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      <section className="panel dashboard-panel">
        <h3>
          Reportes de los trabajadores <span>({m.reports.length})</span>
        </h3>
        {!canManage && (
          <p className="muted">
            Aquí se muestran únicamente los reportes que tu acceso permite
            consultar.
          </p>
        )}
        {!m.reports.length ? (
          <p>Sin reportes recibidos para esta obra.</p>
        ) : (
          m.reports.map((r) => (
            <article className="worker-report" key={r.id}>
              <header>
                <strong>
                  {r.author_name ||
                    (r.author_id
                      ? `Trabajador · ${r.author_id.slice(0, 8)}`
                      : "Equipo de demostración")}
                </strong>
                <time dateTime={r.created_at}>{date(r.created_at)}</time>
              </header>
              <p className="report-notes">{r.notes}</p>
              <p>
                <b>{num(Number(r.hours))} h</b> reportadas ·{" "}
                <b>{num(Number(r.rolls))} rollos</b> utilizados
              </p>
              <small className="muted">
                Pendiente de revisión · nombre declarado en el reporte
              </small>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
