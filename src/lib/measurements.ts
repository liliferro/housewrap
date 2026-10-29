import { z } from "zod";
export const measurementsSchema = z.object({
  version: z.literal(1),
  units: z.enum(["ft", "m"]),
  reference: z.string().trim().max(200),
  reviewed: z.literal(true),
  roll_width_ft: z.number().positive().max(100),
  roll_length_ft: z.number().positive().max(1000),
  rows: z
    .array(
      z.object({
        label: z.string().trim().max(100),
        shape: z.enum(["rectangle", "triangle"]),
        width: z.number().positive().max(10000),
        height: z.number().positive().max(10000),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(100),
});
export type Measurements = z.infer<typeof measurementsSchema>;
export function measureWalls(input: unknown) {
  const m = measurementsSchema.parse(input);
  const factor = m.units === "m" ? 1250 / 381 : 1;
  const rows = m.rows.map((r) => ({
    ...r,
    area:
      r.width *
      r.height *
      r.quantity *
      (r.shape === "triangle" ? 0.5 : 1) *
      factor *
      factor,
  }));
  const area = Math.round(rows.reduce((n, r) => n + r.area, 0) * 100) / 100;
  const rollSize = Math.round(m.roll_width_ft * m.roll_length_ft * 100) / 100;
  if (area < 0.01 || area > 1000000 || rollSize < 0.01)
    throw new Error(
      "Revisa las dimensiones: el área o el tamaño del rollo están fuera de rango.",
    );
  return { measurements: m, rows, area, rollSize };
}
export function measurementText(m: Measurements) {
  const result = measureWalls(m);
  return `Medición asistida v1 · ${m.reference || "Sin referencia de plano"}\nUnidades de entrada: ${m.units}\n${m.rows.map((r) => `${r.label || "Paño"}: ${r.shape === "triangle" ? "triángulo" : "rectángulo"} ${r.width} × ${r.height} × ${r.quantity}${r.shape === "triangle" ? " ÷ 2" : ""}`).join("\n")}\nÁrea bruta: ${result.area} ft²\nRollo nominal: ${m.roll_width_ft} × ${m.roll_length_ft} ft\nAberturas sin descontar. Reserva de material global; sin despiece de solapes, flashing ni cintas.`;
}
