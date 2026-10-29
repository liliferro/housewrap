"use client";
import { useState } from "react";
import { measureWalls, type Measurements } from "@/lib/measurements";
import { num } from "@/lib/model";
const initial: Measurements = {
  version: 1,
  units: "ft",
  reference: "",
  reviewed: true,
  roll_width_ft: 9,
  roll_length_ft: 150,
  rows: [
    { label: "Fachada", shape: "rectangle", width: 0, height: 0, quantity: 1 },
  ],
};
export function MeasurementsCalculator({
  value,
  reserve,
  onApply,
}: {
  value: Measurements | null;
  reserve: number;
  onApply: (m: Measurements) => void;
}) {
  const [expanded, setExpanded] = useState(false),
    [draft, setDraft] = useState<Measurements>(value || initial),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState("");
  let result: ReturnType<typeof measureWalls> | null = null;
  try {
    result = measureWalls(draft);
  } catch {
    /* Incomplete dimensions have no preview. */
  }
  function patch(index: number, key: string, value: string | number) {
    setConfirmed(false);
    setDraft({
      ...draft,
      rows: draft.rows.map((r, i) =>
        i === index ? { ...r, [key]: value } : r,
      ),
    });
  }
  return (
    <section className="measurements-assistant">
      <button
        type="button"
        className="text-link"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? "Cerrar cálculo por fachadas"
          : "Calcular desde medidas del plano"}{" "}
        →
      </button>
      {value && (
        <p className="small">
          Medición aplicada: {num(measureWalls(value).area)} ft² ·{" "}
          {value.rows.length} paños.
        </p>
      )}
      {expanded && (
        <div>
          <h3>Medición asistida provisional</h3>
          <p className="small muted">
            Introduce las cotas de las fachadas o perímetro × altura por nivel.
            Usa la altura vertical del frontón. No uses el área interior ni
            sumes una fachada dos veces. Este asistente no lee ni mide un PDF
            automáticamente.
          </p>
          <div className="form-grid">
            <label>
              Referencia del plano / revisión
              <input
                value={draft.reference}
                maxLength={200}
                onChange={(e) =>
                  setDraft({ ...draft, reference: e.target.value })
                }
                placeholder="A-201 · revisión 2"
              />
            </label>
            <label>
              Unidades del plano
              <select
                value={draft.units}
                onChange={(e) => {
                  setDraft({ ...draft, units: e.target.value as "ft" | "m" });
                  setConfirmed(false);
                }}
              >
                <option value="ft">Pies decimales (ft)</option>
                <option value="m">Metros (m)</option>
              </select>
            </label>
          </div>
          <p className="small muted">
            Ejemplo: 8 pies 6 pulgadas = 8.5 ft. Si mides sobre un plano
            digital, verifica su escala con una cota conocida.
          </p>
          {draft.rows.map((r, i) => (
            <fieldset className="measurement-row" key={i}>
              <legend>Paño {i + 1}</legend>
              <div className="form-grid">
                <label>
                  Descripción del paño {i + 1}
                  <input
                    value={r.label}
                    maxLength={100}
                    onChange={(e) => patch(i, "label", e.target.value)}
                  />
                </label>
                <label>
                  Forma del paño {i + 1}
                  <select
                    value={r.shape}
                    onChange={(e) => patch(i, "shape", e.target.value)}
                  >
                    <option value="rectangle">Muro rectangular</option>
                    <option value="triangle">Frontón triangular</option>
                  </select>
                </label>
                <label>
                  Base / longitud del paño {i + 1} ({draft.units})
                  <input
                    type="number"
                    min="0.01"
                    max="10000"
                    step="0.01"
                    value={r.width || ""}
                    onChange={(e) => patch(i, "width", Number(e.target.value))}
                  />
                </label>
                <label>
                  Altura del paño {i + 1} ({draft.units})
                  <input
                    type="number"
                    min="0.01"
                    max="10000"
                    step="0.01"
                    value={r.height || ""}
                    onChange={(e) => patch(i, "height", Number(e.target.value))}
                  />
                </label>
                <label>
                  Cantidad del paño {i + 1}
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={r.quantity}
                    onChange={(e) =>
                      patch(i, "quantity", Number(e.target.value))
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setDraft({
                    ...draft,
                    rows: draft.rows.filter((_, n) => n !== i),
                  });
                  setConfirmed(false);
                }}
              >
                Quitar paño {i + 1}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="button outline compact"
            disabled={draft.rows.length >= 100}
            onClick={() => {
              setDraft({
                ...draft,
                rows: [
                  ...draft.rows,
                  {
                    label: "",
                    shape: "rectangle",
                    width: 0,
                    height: 0,
                    quantity: 1,
                  },
                ],
              });
              setConfirmed(false);
            }}
          >
            Agregar paño
          </button>
          <div className="form-grid">
            <label>
              Ancho del rollo (ft)
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={draft.roll_width_ft}
                onChange={(e) => {
                  setDraft({ ...draft, roll_width_ft: Number(e.target.value) });
                  setConfirmed(false);
                }}
              />
            </label>
            <label>
              Largo del rollo (ft)
              <input
                type="number"
                min="0.01"
                max="1000"
                step="0.01"
                value={draft.roll_length_ft}
                onChange={(e) => {
                  setDraft({
                    ...draft,
                    roll_length_ft: Number(e.target.value),
                  });
                  setConfirmed(false);
                }}
              />
            </label>
          </div>
          <p className="small">
            <strong>Fórmula:</strong> Σ(base × altura × cantidad) para muros +
            Σ(base × altura × cantidad ÷ 2) para frontones.
          </p>
          <p className="small">
            <strong>Rollos:</strong> redondear hacia arriba [área bruta × (1 +
            reserva / 100) ÷ área nominal del rollo]. La reserva actual es{" "}
            {num(reserve)}%; es una hipótesis de oficina para cortes y solapes,
            no un porcentaje recomendado por el fabricante.
          </p>
          <div className="estimate-result">
            <span>
              Área bruta<strong>{result ? num(result.area) : "—"} ft²</strong>
            </span>
            <span>
              Rollos provisionales
              <strong>
                {result
                  ? Math.ceil(
                      (result.area * (1 + reserve / 100)) / result.rollSize,
                    )
                  : "—"}
              </strong>
            </span>
          </div>
          <label className="measurement-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Verifiqué cotas, unidades, paños y tamaño del rollo.
          </label>
          <button
            type="button"
            className="button"
            disabled={!result || !confirmed}
            onClick={() => {
              try {
                const checked = measureWalls(draft);
                onApply(checked.measurements);
                setExpanded(false);
                setError("");
              } catch {
                setError("Revisa las dimensiones antes de aplicar.");
              }
            }}
          >
            Aplicar medición al estimado
          </button>
          {error && <p role="alert">{error}</p>}
          <p className="small muted">
            Área bruta sin descuentos de puertas o ventanas. No incluye cálculo
            individual de solapes, remates, flashing, cinta, fijaciones ni
            varias capas. Verifica el producto y el detalle constructivo antes
            de comprar material.
          </p>
          <p className="small">
            Fuentes:{" "}
            <a
              target="_blank"
              rel="noreferrer"
              href="https://support.bluebeam.com/online-help/revu20/Content/RevuHelp/Unsorted/Takeoffs-and-Measuring--T.htm"
            >
              calibración de Bluebeam
            </a>{" "}
            ·{" "}
            <a
              target="_blank"
              rel="noreferrer"
              href="https://www.typar.com/assets/downloads/typar-buildingwrap-installation-guide.pdf"
            >
              instalación TYPAR
            </a>
          </p>
        </div>
      )}
    </section>
  );
}
export function MeasurementDetails({ value }: { value?: Measurements | null }) {
  if (!value) return null;
  return (
    <details className="measurement-saved">
      <summary>Ver medición del plano</summary>
      <p className="small">
        Asistida · {value.reference || "Sin referencia"} · cotas en{" "}
        {value.units}
      </p>
      {value.rows.map((r, i) => (
        <p className="small" key={i}>
          {r.label || `Paño ${i + 1}`}: {r.width} × {r.height} × {r.quantity}
          {r.shape === "triangle" ? " ÷ 2" : ""}
        </p>
      ))}
      <p className="small">
        Rollo: {value.roll_width_ft} × {value.roll_length_ft} ft. Área bruta;
        reserva global, sin despiece.
      </p>
    </details>
  );
}
