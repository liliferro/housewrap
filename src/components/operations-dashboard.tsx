"use client";
import { areaProgress } from "@/lib/area-progress";
import { useState } from "react";
import { type Data, money, num } from "@/lib/model";
import { operationMetrics } from "@/lib/operations";

export function OperationsDashboard({
  data,
  canManage,
  open,
  field,
}: {
  data: Data;
  canManage: boolean;
  open: (id: string) => void;
  field: () => void;
}) {
  const [filter, setFilter] = useState("open");
  const [today] = useState(() => new Date());
  const rows = data.projects
    .map((project) => ({ project, ...operationMetrics(project, data, today) }))
    .sort((a, b) => {
      if (a.project.status === "done" && b.project.status !== "done") return 1;
      if (b.project.status === "done" && a.project.status !== "done") return -1;
      return (
        (a.days ?? Infinity) - (b.days ?? Infinity) ||
        a.project.name.localeCompare(b.project.name)
      );
    });
  const ongoing = rows.filter((r) => r.project.status !== "done");
  const late = ongoing.filter((r) => r.days !== null && r.days < 0);
  const soon = ongoing.filter(
    (r) => r.days !== null && r.days >= 0 && r.days <= 7,
  );
  const visible = rows.filter(
    (r) =>
      filter === "all" ||
      (r.project.status !== "done" &&
        (filter === "open" ||
          (filter === "late"
            ? r.days !== null && r.days < 0
            : r.days !== null && r.days >= 0 && r.days <= 7))),
  );
  const alerts = ongoing.flatMap((r) =>
    r.alerts.map((message) => ({
      id: r.project.id,
      name: r.project.name,
      message,
    })),
  );
  const date = (value: string) =>
    new Date(value).toLocaleString("es", {
      dateStyle: "short",
      timeStyle: "short",
    });
  return (
    <div className="operations-dashboard">
      <div className="stats">
        <article>
          <span>Obras en ejecución</span>
          <strong>
            {ongoing.filter((r) => r.project.status === "active").length}
          </strong>
          <small>
            {ongoing.filter((r) => r.project.status === "scheduled").length}{" "}
            programadas ·{" "}
            {rows.filter((r) => r.project.status === "done").length} terminadas
          </small>
        </article>
        <article>
          <span>Entregas próximas</span>
          <strong>{soon.length}</strong>
          <small>Hoy y próximos 7 días · {late.length} vencidas</small>
        </article>
        <article>
          <span>Rollos consumidos</span>
          <strong>{num(ongoing.reduce((sum, r) => sum + r.rolls, 0))}</strong>
          <small>Acumulado reportado en obras abiertas</small>
        </article>
        <article>
          <span>
            {canManage ? "Presupuesto cotizado" : "Horas registradas"}
          </span>
          <strong>
            {canManage
              ? money(
                  ongoing.reduce(
                    (sum, r) => sum + Number(r.quote?.total || 0),
                    0,
                  ),
                )
              : num(ongoing.reduce((sum, r) => sum + r.hours, 0))}
          </strong>
          <small>
            {canManage
              ? `${ongoing.filter((r) => !r.quote).length} obras abiertas sin cotización de referencia`
              : "Acumulado de tus avances visibles"}
          </small>
        </article>
      </div>
      <div className="operations-layout">
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Control de obras</h2>
              <p className="muted small">
                Ordenadas por entrega · porcentaje declarado por oficina
              </p>
            </div>
            <button className="text-link" onClick={field}>
              Registrar avance →
            </button>
          </div>
          <div className="operations-filters" aria-label="Filtrar obras">
            {[
              ["open", `Abiertas (${ongoing.length})`],
              ["soon", `Próximas (${soon.length})`],
              ["late", `Vencidas (${late.length})`],
              ["all", `Todas (${rows.length})`],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {!visible.length && (
            <p className="empty-inline">No hay obras en esta vista.</p>
          )}
          <div className="operations-cards">
            {visible.map((r) => {
              const p = r.project;
              const contact = data.contacts.find((c) => c.id === p.contact_id);
              return (
                <article className="operation-card" key={p.id}>
                  <div className="operation-title">
                    <div>
                      <button className="text-link" onClick={() => open(p.id)}>
                        {p.name} →
                      </button>
                      <p className="muted small">
                        {data.builders.find((b) => b.id === p.builder_id)
                          ?.name || p.builder}
                      </p>
                    </div>
                    <span
                      className={`delivery-badge ${p.status !== "done" && r.days !== null && r.days < 0 ? "overdue" : ""}`}
                    >
                      {p.status === "done"
                        ? "Terminada"
                        : r.days === null
                          ? "Sin fecha de entrega"
                          : r.days < 0
                            ? `${Math.abs(r.days)} días de atraso`
                            : r.days === 0
                              ? "Entrega hoy"
                              : `Faltan ${r.days} días`}
                    </span>
                  </div>
                  <p className="muted small">
                    {p.address}{" "}
                    {p.target_date &&
                      `· Entrega: ${p.target_date.split("-").reverse().join("/")}`}
                  </p>
                  <div className="operation-progress">
                    <span>
                      {p.status === "active"
                        ? "En obra"
                        : p.status === "done"
                          ? "Terminada"
                          : "Programada"}
                    </span>
                    <strong>
                      {areaProgress(p, data).percent == null
                        ? "Avance sin registrar"
                        : `${areaProgress(p, data).percent}% de avance`}
                    </strong>
                  </div>
                  {areaProgress(p, data).percent != null && (
                    <progress
                      value={areaProgress(p, data).percent || 0}
                      max={100}
                      aria-label={`Avance de ${p.name}`}
                    />
                  )}
                  <p className="small muted">
                    {num(areaProgress(p, data).area)} ft² aprobados /{" "}
                    {areaProgress(p, data).target
                      ? `${num(areaProgress(p, data).target!)} ft² previstos`
                      : "sin área de referencia"}
                    .{" "}
                    {areaProgress(p, data).missing > 0
                      ? `${areaProgress(p, data).missing} avances aprobados sin área registrada.`
                      : ""}{" "}
                    {areaProgress(p, data).over
                      ? "El área supera el estimado: revisa posibles duplicados o cambios de alcance."
                      : ""}
                  </p>
                  <dl className="operation-metrics">
                    <div>
                      <dt>Rollos consumidos</dt>
                      <dd>
                        {num(r.rolls)}
                        {r.quote && (
                          <small> / {num(r.quote.rolls)} previstos</small>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Material estimado restante</dt>
                      <dd>
                        {r.quote
                          ? r.rolls > r.quote.rolls
                            ? `${num(r.rolls - r.quote.rolls)} de exceso`
                            : `${num(r.quote.rolls - r.rolls)} rollos`
                          : "Sin estimado"}
                      </dd>
                    </div>
                    <div>
                      <dt>Horas reportadas</dt>
                      <dd>{num(r.hours)} h</dd>
                    </div>
                    <div>
                      <dt>
                        {canManage
                          ? "Cotización de referencia"
                          : "Avances recibidos"}
                      </dt>
                      <dd>
                        {canManage
                          ? r.quote
                            ? money(r.quote.total)
                            : "Por definir"
                          : r.reports.length}
                      </dd>
                    </div>
                  </dl>
                  <p className="small muted">
                    Inicio:{" "}
                    {p.started_at ? date(p.started_at) : "sin registrar"} ·
                    Contacto: {contact?.name || "sin asignar"}
                  </p>
                  {contact && (
                    <p className="operation-contact small">
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`}>{contact.email}</a>
                      )}
                    </p>
                  )}
                  <div className="operation-latest">
                    <strong>Último avance</strong>
                    {r.reports[0] ? (
                      <>
                        <span className="small muted">
                          {date(r.reports[0].created_at)} ·{" "}
                          {r.reports[0].author_name || "Equipo"}
                        </span>
                        <p>
                          {r.reports[0].notes || "Fotos o nota de voz adjuntas"}
                        </p>
                        <span className="small muted">
                          {r.reports[0].attachments?.length || 0} adjuntos · Ver
                          detalle en la obra
                        </span>
                      </>
                    ) : (
                      <p className="muted">Aún no se han registrado avances.</p>
                    )}
                  </div>
                  {p.progress_notes && (
                    <p className="small">
                      <strong>Nota de oficina:</strong> {p.progress_notes}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
        <aside className="panel operations-attention">
          <div className="section-head">
            <h2>Atención de Daniel</h2>
          </div>
          <div className="attention-content">
            <p className="small muted">
              Fechas, actividad y materiales de obras abiertas.
            </p>
            {alerts.length ? (
              alerts.map((a, i) => (
                <button
                  className="attention-item"
                  key={`${a.id}-${i}`}
                  onClick={() => open(a.id)}
                >
                  <strong>{a.name}</strong>
                  <span>{a.message}</span>
                </button>
              ))
            ) : (
              <p>Sin alertas con los datos registrados.</p>
            )}
            <p className="small muted">
              Los rollos y las horas se suman de los avances. El material
              restante compara el consumo con la cotización; no representa
              inventario disponible.
            </p>
            {!canManage && (
              <p className="small muted">
                Solo se incluyen las obras y avances que tu cuenta puede
                consultar.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
