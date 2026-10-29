import type { Data, Project } from "./model";
export const pipelineStages = {
  received: "Recibido",
  to_quote: "Por presupuestar",
  quoted: "Presupuestado",
  sent: "Enviado",
  reminder_1: "Recordatorio 1",
  reminder_2: "Recordatorio 2",
  won: "Ganado",
  lost: "Perdido",
} as const;
export type PipelineStage = keyof typeof pipelineStages;
export function pipelineOpportunity(project: Project, data: Data) {
  const estimates = data.estimates
    .filter((e) => e.project_id === project.id)
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
  const estimate =
    estimates.find(
      (e) => e.id === project.quoted_estimate_id && e.status === "approved",
    ) || estimates[0];
  const stage = project.pipeline_stage || (estimate ? "quoted" : "received");
  return {
    project,
    estimate,
    stage,
    amount: estimate ? Number(estimate.total) : null,
  };
}
export function pipelineSummary(data: Data) {
  const opportunities = data.projects.map((p) => pipelineOpportunity(p, data));
  return Object.entries(pipelineStages).map(([key, label]) => {
    const stage = key as PipelineStage;
    const items = opportunities.filter((o) => o.stage === stage);
    return {
      stage,
      label,
      items,
      total: items.reduce((n, o) => n + (o.amount ?? 0), 0),
      unquoted: items.filter((o) => o.amount === null).length,
    };
  });
}
