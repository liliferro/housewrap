"use client";
import { useState } from "react";
import type { Report } from "@/lib/model";
export type ReportCorrectionValues = {
  notes: string;
  hours: number;
  rolls: number;
  installed_area: number | null;
};
export function ReportCorrection({
  report,
  busy,
  save,
}: {
  report: Report;
  busy: boolean;
  save: (r: Report, v: ReportCorrectionValues) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="text-link">Corregir y reenviar avance</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            await save(report, {
              notes: String(f.get("notes")),
              hours: Number(f.get("hours")),
              rolls: Number(f.get("rolls")),
              installed_area:
                f.get("installed_area") === ""
                  ? null
                  : Number(f.get("installed_area")),
            });
            setOpen(false);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "No se pudo corregir.",
            );
          }
        }}
      >
        <label>
          Descripción corregida
          <textarea
            name="notes"
            maxLength={2000}
            required={!report.attachments?.length}
            minLength={report.attachments?.length ? undefined : 5}
            defaultValue={report.notes}
          />
        </label>
        <div className="form-grid">
          <label>
            Horas corregidas
            <input
              name="hours"
              type="number"
              min="0"
              max="24"
              step="0.25"
              required
              defaultValue={report.hours}
            />
          </label>
          <label>
            Rollos corregidos
            <input
              name="rolls"
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              defaultValue={report.rolls}
            />
          </label>
          <label>
            Área instalada corregida (ft²)
            <input
              name="installed_area"
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              defaultValue={report.installed_area ?? ""}
            />
          </label>
        </div>
        <p className="small muted">
          Se conserva el trabajador, la obra, la fecha y los adjuntos. La
          corrección quedará pendiente de una nueva revisión, sin duplicar este
          avance.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          Guardar corrección
        </button>
      </form>
    </details>
  );
}
