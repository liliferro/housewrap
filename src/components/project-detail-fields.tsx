"use client";
import { useState } from "react";
import { type Project } from "@/lib/model";
import {
  projectTypes,
  workTypes,
  priorities,
  parseProjectDetails,
} from "@/lib/project-details";
export function ProjectDetailFields({ project }: { project?: Project }) {
  return (
    <>
      <div className="form-grid">
        <label>
          Zona o sector (opcional)
          <input
            name="zone"
            maxLength={120}
            defaultValue={project?.zone || ""}
            placeholder="Marietta · Sector norte"
          />
        </label>
        <label>
          Tipo de proyecto
          <select
            name="project_type"
            aria-label="Tipo de proyecto"
            defaultValue={project?.project_type || ""}
          >
            <option value="">Por definir</option>
            {Object.entries(projectTypes).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo de trabajo
          <select
            name="work_type"
            aria-label="Tipo de trabajo"
            defaultValue={project?.work_type || ""}
          >
            <option value="">Por definir</option>
            {Object.entries(workTypes).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioridad
          <select
            name="priority"
            aria-label="Prioridad"
            defaultValue={project?.priority || "normal"}
          >
            {Object.entries(priorities).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Lote o unidad (opcional)
          <input
            name="lot_unit"
            maxLength={80}
            defaultValue={project?.lot_unit || ""}
            placeholder="Lot 14 · Unidad B"
          />
        </label>
      </div>
      <label>
        Inicio previsto (opcional)
        <input
          name="planned_start"
          type="date"
          defaultValue={project?.planned_start || ""}
        />
      </label>
      <label>
        Notas de la obra (opcional)
        <textarea
          name="notes"
          aria-label="Notas de la obra (opcional)"
          maxLength={3000}
          defaultValue={project?.notes || ""}
          placeholder="Alcance, requisitos del builder, materiales y detalles importantes."
          rows={3}
        />
      </label>
      <label>
        Acceso e indicaciones (opcional)
        <textarea
          name="access_notes"
          aria-label="Acceso e indicaciones (opcional)"
          maxLength={1000}
          defaultValue={project?.access_notes || ""}
          placeholder="Horario permitido, punto de entrada, estacionamiento o instrucciones para el equipo."
          rows={2}
        />
      </label>
      <p className="small muted">
        Estas notas estarán disponibles para el equipo con acceso a la obra.
      </p>
    </>
  );
}
export function ProjectDetailsPanel({
  project,
  canManage,
  busy,
  save,
}: {
  project: Project;
  canManage: boolean;
  busy: boolean;
  save: (patch: Partial<Project>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="panel dashboard-panel">
      <h3>Ficha de la obra</h3>
      <dl>
        <dt>Zona o sector</dt>
        <dd>{project.zone || "Sin registrar"}</dd>
        <dt>Tipo de proyecto</dt>
        <dd>
          {project.project_type
            ? projectTypes[project.project_type]
            : "Por definir"}
        </dd>
        <dt>Tipo de trabajo</dt>
        <dd>
          {project.work_type ? workTypes[project.work_type] : "Por definir"}
        </dd>
        <dt>Prioridad</dt>
        <dd>{priorities[project.priority || "normal"]}</dd>
        <dt>Lote o unidad</dt>
        <dd>{project.lot_unit || "Sin registrar"}</dd>
        <dt>Inicio previsto</dt>
        <dd>{project.planned_start || "Por definir"}</dd>
      </dl>
      <h4>Notas de la obra</h4>
      <p className="report-notes">
        {project.notes || "Sin notas registradas."}
      </p>
      <h4>Acceso e indicaciones</h4>
      <p className="report-notes">
        {project.access_notes || "Sin indicaciones registradas."}
      </p>
      {canManage && (
        <button
          className="text-link"
          onClick={() => {
            setEditing(!editing);
            setError("");
          }}
        >
          {editing ? "Cancelar edición" : "Editar ficha de la obra"}
        </button>
      )}
      {editing && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await save(parseProjectDetails(f, project.target_date));
              setEditing(false);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "No se pudo guardar la ficha.",
              );
            }
          }}
        >
          <ProjectDetailFields project={project} />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            Guardar ficha
          </button>
        </form>
      )}
    </section>
  );
}
