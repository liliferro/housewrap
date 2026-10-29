revoke update on public.field_reports from public,anon,authenticated;
grant update(review_status,review_note) on public.field_reports to authenticated;
