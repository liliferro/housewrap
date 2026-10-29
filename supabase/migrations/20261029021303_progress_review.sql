begin;
alter table public.field_reports
 add column review_status text not null default 'pending' check(review_status in ('pending','approved','observed')),
 add column review_note text not null default '' check(length(review_note)<=2000),
 add column reviewed_at timestamptz,
 add column reviewed_by uuid references auth.users(id);
grant update(review_status,review_note) on public.field_reports to authenticated;
create policy reports_review on public.field_reports for update to authenticated
 using(private.has_role(array['owner','office'])) with check(private.has_role(array['owner','office']));
create function private.validate_report_review() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.review_status<>'pending' or new.review_note<>'' or new.reviewed_at is not null or new.reviewed_by is not null then raise exception 'New advances must await review'; end if;
 else
  if not private.has_role(array['owner','office']) then raise exception 'Review requires office access'; end if;
  if new.review_status not in ('approved','observed') then raise exception 'Choose a review decision'; end if;
  if new.review_status='observed' and length(trim(new.review_note))<5 then raise exception 'Observation required'; end if;
  new.reviewed_at=now(); new.reviewed_by=auth.uid();
 end if;
 return new;
end; $$;
revoke all on function private.validate_report_review() from public,anon;
create trigger validate_report_review before insert or update on public.field_reports for each row execute function private.validate_report_review();
commit;
