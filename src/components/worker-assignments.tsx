"use client";
import { type Data } from "@/lib/model";
import { browserDb } from "@/lib/supabase";
export function WorkerFields({
  data,
  projectId,
}: {
  data: Data;
  projectId?: string;
}) {
  return (
    <fieldset className="worker-fields">
      <legend>Trabajadores asignados</legend>
      <p className="small muted">
        Solo estas personas podrán ver la obra y registrar sus avances.
      </p>
      {!(data.workers || []).length && (
        <p className="small">
          Primero crea los trabajadores en el módulo Trabajadores.
        </p>
      )}
      {(data.workers || []).map((w) => (
        <label key={w.user_id}>
          <input
            type="checkbox"
            name="worker_ids"
            value={w.user_id}
            defaultChecked={(data.assignments || []).some(
              (a) => a.project_id === projectId && a.user_id === w.user_id,
            )}
          />
          <span>
            {w.full_name}
            <small className="muted">{w.email}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
export function AssignmentEditor({
  data,
  projectId,
  demo,
  busy,
  persist,
  run,
}: {
  data: Data;
  projectId: string;
  demo: boolean;
  busy: boolean;
  persist: (d: Data) => void;
  run: (fn: () => Promise<void>) => Promise<void>;
}) {
  return (
    <section className="panel dashboard-panel">
      <h3>Equipo de esta obra</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const ids = new FormData(e.currentTarget)
            .getAll("worker_ids")
            .map(String);
          void run(async () => {
            if (!demo) {
              const result = await browserDb().rpc("set_project_workers", {
                p_project_id: projectId,
                p_worker_ids: ids,
              });
              if (result.error)
                throw new Error(
                  "No se pudo guardar el equipo. Revisa los trabajadores seleccionados.",
                );
            }
            persist({
              ...data,
              assignments: [
                ...(data.assignments || []).filter(
                  (a) => a.project_id !== projectId,
                ),
                ...ids.map((user_id) => ({ project_id: projectId, user_id })),
              ],
            });
          });
        }}
      >
        <WorkerFields
          key={(data.assignments || [])
            .filter((a) => a.project_id === projectId)
            .map((a) => a.user_id)
            .join(",")}
          data={data}
          projectId={projectId}
        />
        <button className="button" disabled={busy}>
          Guardar equipo
        </button>
      </form>
    </section>
  );
}
