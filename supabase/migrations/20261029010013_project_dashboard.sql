alter table public.projects
 add column progress integer not null default 0 check(progress between 0 and 100),
 add column progress_notes text not null default '' check(length(progress_notes)<=2000),
 add column started_at timestamptz,
 add column finished_at timestamptz,
 add column quoted_estimate_id uuid references public.estimates(id),
 add constraint project_dates_order check(finished_at is null or (started_at is not null and finished_at>=started_at));
create index projects_quote_idx on public.projects(quoted_estimate_id);
alter table public.field_reports add column author_name text check(author_name is null or length(trim(author_name)) between 2 and 100);
create function private.validate_project_quote() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.quoted_estimate_id is not null and not exists(select 1 from public.estimates e where e.id=new.quoted_estimate_id and e.project_id=new.id and e.status='approved') then
 raise exception 'Choose an approved estimate belonging to this project';
 end if;
 return new;
end $$;
revoke all on function private.validate_project_quote() from public,anon;
create trigger validate_project_quote before insert or update of quoted_estimate_id on public.projects for each row execute function private.validate_project_quote();
