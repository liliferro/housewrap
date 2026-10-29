"use client";
import { useState } from "react";
import { type Data, type Report, num } from "@/lib/model";
import { ProgressAttachments } from "./progress-media";
export const reviewLabels = {
  pending: "Pendiente de revisión",
  approved: "Aprobado",
  observed: "Con observaciones",
};
export function ReviewStatus({ report }: { report: Report }) {
  return (
    <div className="review-status">
      <span
        className={`review-tag review-${report.review_status || "pending"}`}
      >
        {reviewLabels[report.review_status || "pending"]}
      </span>
      {report.reviewed_at && (
        <small className="muted">
          Revisado el {new Date(report.reviewed_at).toLocaleString("es")}
        </small>
      )}
      {report.review_note && (
        <p>
          <strong>Observación de oficina:</strong> {report.review_note}
        </p>
      )}
    </div>
  );
}
function ReviewCard({
  report,
  data,
  busy,
  review,
  open,
}: {
  report: Report;
  data: Data;
  busy: boolean;
  review: (
    r: Report,
    status: "approved" | "observed",
    note: string,
  ) => Promise<void>;
  open: (id: string) => void;
}) {
  const [note, setNote] = useState(report.review_note || "");
  const [error, setError] = useState("");
  async function decide(status: "approved" | "observed") {
    setError("");
    if (status === "observed" && note.trim().length < 5) {
      setError(
        "Escribe qué debe corregirse o aclararse (al menos 5 caracteres).",
      );
      return;
    }
    try {
      await review(report, status, note.trim());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar la revisión.",
      );
    }
  }
  return (
    <article className="panel review-card">
      <div className="section-head">
        <div>
          <button className="text-link" onClick={() => open(report.project_id)}>
            {data.projects.find((p) => p.id === report.project_id)?.name ||
              "Obra"}{" "}
            →
          </button>
          <p className="small muted">
            {report.author_name || "Trabajador"} ·{" "}
            {new Date(report.created_at).toLocaleString("es")}
          </p>
        </div>
        <strong>
          {num(report.hours)} h · {num(report.rolls)} rollos
        </strong>
      </div>
      <div className="review-body">
        <p className="small muted">
          Fecha trabajada: {report.work_date || "Sin fecha registrada"}
        </p>
        <p>
          Área instalada:{" "}
          {report.installed_area == null
            ? "Sin medir (no suma al porcentaje)"
            : `${num(report.installed_area)} ft²`}
        </p>
        <ReviewStatus report={report} />
        <p className="report-notes">
          {report.notes || "Avance con fotos o audio adjuntos."}
        </p>
        <ProgressAttachments attachments={report.attachments} />
        {report.review_status !== "approved" && (
          <>
            <label>
              Observación de revisión
              <textarea
                aria-label={`Observación para ${report.author_name || "trabajador"}`}
                value={note}
                maxLength={2000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Indica lo que se debe aclarar o corregir. Opcional al aprobar."
              />
            </label>
            <div className="actions">
              <button
                className="button"
                disabled={busy}
                onClick={() => void decide("approved")}
              >
                Aprobar avance
              </button>
              <button
                className="button outline"
                disabled={busy}
                onClick={() => void decide("observed")}
              >
                Devolver con observaciones
              </button>
            </div>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </article>
  );
}
export function ProgressReview({
  data,
  busy,
  review,
  open,
}: {
  data: Data;
  busy: boolean;
  review: (
    r: Report,
    status: "approved" | "observed",
    note: string,
  ) => Promise<void>;
  open: (id: string) => void;
}) {
  const [filter, setFilter] = useState("pending"),
    [project, setProject] = useState("");
  const reports = [...data.reports]
    .filter(
      (r) =>
        (filter === "all" || (r.review_status || "pending") === filter) &&
        (!project || r.project_id === project),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <section aria-label="Bandeja de revisión de avances">
      <div className="operations-filters">
        {Object.entries({ ...reviewLabels, all: "Todos" }).map(
          ([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label} (
              {
                data.reports.filter(
                  (r) =>
                    value === "all" || (r.review_status || "pending") === value,
                ).length
              }
              )
            </button>
          ),
        )}
      </div>
      <label className="review-project-filter">
        Filtrar por obra
        <select value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">Todas las obras</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <p className="small muted">
        La aprobación confirma la revisión operativa del avance. No genera pagos
        ni suma horas automáticamente a nómina. Las observaciones quedan
        visibles en la obra; no se envían mensajes.
      </p>
      <div className="review-list">
        {reports.map((r) => (
          <ReviewCard
            key={r.id}
            report={r}
            data={data}
            busy={busy}
            review={review}
            open={open}
          />
        ))}
        {!reports.length && (
          <div className="panel empty-inline">
            No hay avances en esta vista.
          </div>
        )}
      </div>
    </section>
  );
}
