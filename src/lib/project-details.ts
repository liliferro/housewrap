import { z } from "zod";
export const projectTypes = {
  single_family: "Residencial unifamiliar",
  multi_family: "Residencial multifamiliar",
  commercial: "Comercial",
  other: "Otro",
} as const;
export const workTypes = {
  new_construction: "Construcción nueva",
  remodel: "Remodelación",
  repair: "Reparación",
  other: "Otro",
} as const;
export const priorities = {
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
} as const;
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().default("");
export const projectDetailsSchema = z.object({
  project_type: z
    .enum(["single_family", "multi_family", "commercial", "other", ""])
    .optional()
    .transform((v) => v || null),
  work_type: z
    .enum(["new_construction", "remodel", "repair", "other", ""])
    .optional()
    .transform((v) => v || null),
  priority: z.enum(["normal", "high", "urgent"]).optional().default("normal"),
  lot_unit: optionalText(80),
  notes: optionalText(3000),
  access_notes: optionalText(1000),
  planned_start: z
    .string()
    .date()
    .or(z.literal(""))
    .optional()
    .transform((v) => v || null),
});
export type ProjectDetails = z.output<typeof projectDetailsSchema>;
export function parseProjectDetails(form: FormData, target?: string | null) {
  const details = projectDetailsSchema.parse(Object.fromEntries(form));
  if (details.planned_start && target && details.planned_start > target)
    throw new Error(
      "El inicio previsto no puede ser posterior a la fecha objetivo.",
    );
  return details;
}
