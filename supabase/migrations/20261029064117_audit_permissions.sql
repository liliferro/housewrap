begin;
-- Remove inherited table-wide privileges that bypass column-specific grants.
revoke all on public.memberships,public.projects,public.assignments,public.estimates,public.field_reports,public.builders,public.contacts,public.workers,public.worker_rates from anon,public;
revoke truncate,references,trigger on public.memberships,public.projects,public.assignments,public.estimates,public.field_reports,public.builders,public.contacts,public.workers,public.worker_rates from authenticated;
revoke insert,update,delete on public.memberships from authenticated;
revoke delete on public.projects,public.estimates,public.field_reports from authenticated;
revoke insert,update on public.estimates from authenticated;
grant insert(project_id,area,rate,waste,roll_size,measurements),update(status) on public.estimates to authenticated;
drop policy assignments_read on public.assignments;
create policy assignments_read on public.assignments for select to authenticated using(private.has_role(array['owner','office']) or (user_id=(select auth.uid()) and private.has_role(array['worker','crew_lead'])));
-- Returned advances can be corrected without duplicating hours or material.
alter table public.field_reports add column correction_history jsonb not null default '[]'::jsonb;
grant update(notes,hours,rolls,installed_area) on public.field_reports to authenticated;
create policy reports_correct_own on public.field_reports for update to authenticated using(author_id=(select auth.uid()) and review_status in ('pending','observed') and private.has_role(array['worker','crew_lead']) and exists(select 1 from public.assignments a where a.project_id=field_reports.project_id and a.user_id=(select auth.uid()))) with check(author_id=(select auth.uid()) and review_status='pending' and private.has_role(array['worker','crew_lead']));
create or replace function private.validate_report_review() returns trigger language plpgsql security invoker set search_path='' as $$
declare used_hours numeric;
begin
 if tg_op='INSERT' then
  if new.review_status<>'pending' or new.review_note<>'' or new.reviewed_at is not null or new.reviewed_by is not null then raise exception 'New advances must await review'; end if;
  new.correction_history:='[]'::jsonb;
 else
  if old.review_status='approved' then raise exception 'Approved advances are locked';end if;
  if new.review_status='pending' then
   if not private.has_role(array['owner','office']) and not (old.author_id=auth.uid() and private.has_role(array['worker','crew_lead']) and exists(select 1 from public.assignments where project_id=old.project_id and user_id=auth.uid())) then raise exception 'Correction not permitted';end if;
   perform pg_advisory_xact_lock(hashtextextended(new.author_id::text||new.work_date::text,0));
   select coalesce(sum(hours),0) into used_hours from public.field_reports where author_id=new.author_id and work_date=new.work_date and id<>old.id;
   if used_hours+new.hours>24 then raise exception 'More than 24 hours for this date';end if;
   new.correction_history:=old.correction_history || jsonb_build_array(jsonb_build_object('at',now(),'by',auth.uid(),'previous_notes',old.notes,'previous_hours',old.hours,'previous_rolls',old.rolls,'previous_area',old.installed_area,'previous_review_note',old.review_note,'previous_status',old.review_status));
   new.review_note:='';new.reviewed_at:=null;new.reviewed_by:=null;
  else
   if not private.has_role(array['owner','office']) then raise exception 'Review requires office access'; end if;
   if new.notes is distinct from old.notes or new.hours is distinct from old.hours or new.rolls is distinct from old.rolls or new.installed_area is distinct from old.installed_area then raise exception 'Save corrections before approval';end if;
   if new.review_status not in ('approved','observed') then raise exception 'Choose a review decision'; end if;
   if new.review_status='observed' and length(trim(new.review_note))<5 then raise exception 'Observation required'; end if;
   new.reviewed_at:=now();new.reviewed_by:=auth.uid();
  end if;
 end if;
 return new;
end;$$;
commit;
