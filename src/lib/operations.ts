import type { Data, Project } from "./model";

export function deliveryDays(target: string | null, today: Date) {
  if (!target) return null;
  const [y, m, d] = target.split("-").map(Number);
  return Math.round(
    (Date.UTC(y, m - 1, d) -
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) /
      86400000,
  );
}
export function operationMetrics(project: Project, data: Data, today: Date) {
  const reports = data.reports
    .filter((r) => r.project_id === project.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const quote = data.estimates.find(
    (e) =>
      e.project_id === project.id &&
      e.id === project.quoted_estimate_id &&
      e.status === "approved",
  );
  const rolls = reports.reduce((sum, r) => sum + Number(r.rolls), 0);
  const hours = reports.reduce((sum, r) => sum + Number(r.hours), 0);
  const days = deliveryDays(project.target_date, today);
  const stale =
    project.status === "active" &&
    (!reports[0] ||
      today.getTime() - Date.parse(reports[0].created_at) >= 3 * 86400000);
  const alerts: string[] = [];
  if (project.status !== "done") {
    if (days !== null && days < 0)
      alerts.push(`Entrega vencida hace ${Math.abs(days)} día(s)`);
    else if (days !== null && days <= 7)
      alerts.push(days === 0 ? "Entrega hoy" : `Entrega en ${days} día(s)`);
    if (stale)
      alerts.push(
        reports.length
          ? "Sin avances en los últimos 3 días"
          : "Sin avances registrados",
      );
    if (quote && rolls > Number(quote.rolls))
      alerts.push("Consumo superior al estimado");
    if (!project.target_date) alerts.push("Falta fecha de entrega");
  }
  return { reports, quote, rolls, hours, days, alerts };
}
