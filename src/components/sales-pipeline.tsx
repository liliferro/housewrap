"use client";
import { type Data, type Estimate, money, num } from "@/lib/model";
import {
  pipelineStages,
  pipelineSummary,
  type PipelineStage,
} from "@/lib/pipeline";
import { MeasurementDetails } from "./measurements";
import { EstimateProjectInfo } from "./estimate-project-info";
export function SalesPipeline({
  data,
  busy,
  canApprove,
  move,
  open,
  prepare,
  approve,
  download,
}: {
  data: Data;
  busy: boolean;
  canApprove: boolean;
  move: (id: string, stage: PipelineStage) => void;
  open: (id: string) => void;
  prepare: (id: string) => void;
  approve: (e: Estimate) => void;
  download: (e: Estimate) => void;
}) {
  const columns = pipelineSummary(data);
  const openColumns = columns.filter(
    (c) => c.stage !== "won" && c.stage !== "lost",
  );
  return (
    <section className="sales-pipeline" aria-label="Pipeline comercial">
      <div className="stats pipeline-stats">
        <article>
          <span>Forecast abierto</span>
          <strong>{money(openColumns.reduce((n, c) => n + c.total, 0))}</strong>
          <small>
            {openColumns.reduce((n, c) => n + c.items.length, 0)} oportunidades
            · {openColumns.reduce((n, c) => n + c.unquoted, 0)} sin cotizar
          </small>
        </article>
        <article>
          <span>Ganado</span>
          <strong>
            {money(columns.find((c) => c.stage === "won")!.total)}
          </strong>
          <small>Importe de oportunidades ganadas</small>
        </article>
        <article>
          <span>Perdido</span>
          <strong>
            {money(columns.find((c) => c.stage === "lost")!.total)}
          </strong>
          <small>Fuera del forecast abierto</small>
        </article>
      </div>
      <p className="muted small">
        Forecast sin ponderar, en USD: una oportunidad por obra. Se usa la
        cotización de referencia o, si no está definida, el último estimado. Los
        importes sin cotizar no se cuentan como ventas de $0.
      </p>
      <p className="muted small">
        Las etapas de envío y recordatorios registran acciones realizadas;
        cambiarlas no envía mensajes.
      </p>
      <div
        className="pipeline-board"
        tabIndex={0}
        role="region"
        aria-label="Etapas del pipeline, desplázate horizontalmente"
      >
        {columns.map((c) => (
          <section
            className={`pipeline-column stage-${c.stage}`}
            key={c.stage}
            aria-label={c.label}
          >
            <header>
              <h2>
                {c.label} <span>{c.items.length}</span>
              </h2>
              <strong>{money(c.total)}</strong>
              <small>
                {c.unquoted
                  ? `${c.unquoted} sin cotizar · importe pendiente`
                  : "Importe de la etapa"}
              </small>
            </header>
            <div className="pipeline-items">
              {!c.items.length && (
                <p className="muted small">Sin oportunidades</p>
              )}
              {c.items.map((o) => (
                <article className="pipeline-card" key={o.project.id}>
                  <EstimateProjectInfo
                    data={data}
                    projectId={o.project.id}
                    open={() => open(o.project.id)}
                  />
                  <strong className="pipeline-amount">
                    {o.amount === null ? "Sin cotizar" : money(o.amount)}
                  </strong>
                  {o.estimate && (
                    <p className="small muted">
                      {num(o.estimate.area)} ft² · {num(o.estimate.rolls)}{" "}
                      rollos ·{" "}
                      {o.estimate.status === "approved"
                        ? "Aprobado internamente"
                        : "Borrador"}
                      <br />
                      {o.project.quoted_estimate_id === o.estimate.id
                        ? "Cotización de referencia"
                        : "Último estimado"}
                    </p>
                  )}
                  <MeasurementDetails value={o.estimate?.measurements} />
                  <label>
                    Etapa comercial
                    <select
                      aria-label={`Etapa de ${o.project.name}`}
                      value={o.stage}
                      disabled={busy}
                      onChange={(e) =>
                        move(o.project.id, e.target.value as PipelineStage)
                      }
                    >
                      {Object.entries(pipelineStages).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {o.project.pipeline_changed_at && (
                    <small className="muted">
                      Actualizada:{" "}
                      {new Date(
                        o.project.pipeline_changed_at,
                      ).toLocaleDateString("es")}
                    </small>
                  )}
                  <div className="pipeline-actions">
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() => prepare(o.project.id)}
                    >
                      {o.estimate ? "Nuevo estimado" : "Presupuestar"}
                    </button>
                    {o.estimate?.status === "draft" && canApprove && (
                      <button
                        className="text-link"
                        disabled={busy}
                        onClick={() => approve(o.estimate!)}
                      >
                        Aprobar
                      </button>
                    )}
                    {o.estimate && (
                      <button
                        className="text-link"
                        onClick={() => download(o.estimate!)}
                      >
                        Descargar
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
