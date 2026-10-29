import type { Data, Project } from "./model";
export function projectQuote(project: Project, data: Data) {
  const approved = data.estimates.filter(
    (e) => e.project_id === project.id && e.status === "approved",
  );
  return (
    approved.find((e) => e.id === project.quoted_estimate_id) ||
    approved.sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    )[0]
  );
}
