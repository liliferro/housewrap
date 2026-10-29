import type { Data, Project } from "./model";
import { projectQuote } from "./quote";
export function areaProgress(project: Project, data: Data, canManage = false) {
  const quote = projectQuote(project, data);
  const reports = data.reports.filter(
    (r) => r.project_id === project.id && r.review_status === "approved",
  );
  const target = quote?.area ?? project.target_area ?? null;
  const area =
    quote || canManage
      ? reports.reduce((n, r) => n + Number(r.installed_area || 0), 0)
      : Number(project.approved_area || 0);
  const missing =
    quote || canManage
      ? reports.filter((r) => r.installed_area == null).length
      : project.unmeasured_reports || 0;
  const percent =
    target && target > 0
      ? Math.min(100, Math.floor((area / target) * 1000) / 10)
      : null;
  return {
    area,
    target,
    missing,
    percent,
    over: target != null && area > target,
  };
}
