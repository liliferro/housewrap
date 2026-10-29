begin;
alter table public.field_reports add column installed_area numeric(12,2) check(installed_area between 0 and 1000000);
grant insert(installed_area) on public.field_reports to authenticated;
alter table public.projects add column approved_area numeric not null default 0, add column target_area numeric, add column unmeasured_reports integer not null default 0;
create function private.compute_area_progress() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select coalesce(sum(installed_area),0),count(*) filter(where installed_area is null) into new.approved_area,new.unmeasured_reports from public.field_reports where project_id=new.id and review_status='approved';
 select area into new.target_area from public.estimates where project_id=new.id and status='approved' order by (id=new.quoted_estimate_id) desc nulls last,created_at desc,id desc limit 1;
 return new;
end;$$;
revoke all on function private.compute_area_progress() from public,anon,authenticated;
create trigger compute_area_progress before insert or update on public.projects for each row execute function private.compute_area_progress();
create function private.refresh_area_progress() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'INSERT' then update public.projects set id=id where id=old.project_id; end if;
 if tg_op<>'DELETE' then update public.projects set id=id where id=new.project_id; end if;
 return null;
end;$$;
revoke all on function private.refresh_area_progress() from public,anon,authenticated;
create trigger refresh_report_area after insert or update or delete on public.field_reports for each row execute function private.refresh_area_progress();
create trigger refresh_estimate_area after insert or update or delete on public.estimates for each row execute function private.refresh_area_progress();
update public.projects set id=id;
commit;
