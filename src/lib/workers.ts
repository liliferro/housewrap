import { z } from "zod";
import type { Data, Report } from "./model";
export type Worker = {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: string;
};
export type WorkerRate = {
  user_id: string;
  effective_date: string;
  hourly_rate: number;
};
export type Assignment = { project_id: string; user_id: string };
export const workerSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  phone: z.string().trim().max(40).default(""),
  hourly_rate: z.coerce.number().positive().max(10000),
  effective_date: z.string().date(),
});
export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function weekRange(value: string) {
  const d = new Date(value + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const start = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 6);
  return { start, end: d.toISOString().slice(0, 10) };
}
export function reportDate(r: Report) {
  return r.work_date || localDate(new Date(r.created_at));
}
export function workerWeek(worker: Worker, data: Data, day: string) {
  const { start, end } = weekRange(day);
  const reports = data.reports
    .filter(
      (r) =>
        r.author_id === worker.user_id &&
        reportDate(r) >= start &&
        reportDate(r) <= end,
    )
    .sort((a, b) => reportDate(b).localeCompare(reportDate(a)));
  const rates = (data.worker_rates || [])
    .filter((r) => r.user_id === worker.user_id)
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date));
  let cents = 0,
    missing = 0;
  const lines = reports.map((report) => {
    const rate = rates.find((r) => r.effective_date <= reportDate(report));
    const approved = report.review_status === "approved";
    const amount =
      approved && rate
        ? Math.round(
            Number(report.hours) * Math.round(Number(rate.hourly_rate) * 100),
          )
        : null;
    if (approved) {
      if (amount === null) missing++;
      else cents += amount;
    }
    return { report, rate, amount: amount === null ? null : amount / 100 };
  });
  const hours = (status: string) =>
    reports
      .filter((r) => (r.review_status || "pending") === status)
      .reduce((n, r) => n + Number(r.hours), 0);
  return {
    start,
    end,
    reports,
    lines,
    approved: hours("approved"),
    pending: hours("pending"),
    observed: hours("observed"),
    missing,
    amount: missing ? null : cents / 100,
    knownAmount: cents / 100,
  };
}
