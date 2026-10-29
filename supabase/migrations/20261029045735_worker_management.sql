begin;
create table public.workers (
 user_id uuid primary key references auth.users(id),
 full_name text not null check(length(trim(full_name)) between 2 and 100),
 email text not null unique,
 phone text not null default '' check(length(phone)<=40),
 created_at timestamptz not null default now()
);
create table public.worker_rates (
 user_id uuid not null references public.workers(user_id),
 effective_date date not null,
 hourly_rate numeric(10,2) not null check(hourly_rate>0 and hourly_rate<=10000),
 primary key(user_id,effective_date)
);
alter table public.workers enable row level security;
alter table public.worker_rates enable row level security;
revoke all on public.workers,public.worker_rates from public,anon,authenticated;
grant select on public.workers,public.worker_rates to authenticated;
grant update(full_name,phone) on public.workers to authenticated;
grant insert on public.worker_rates to authenticated;
grant all on public.workers,public.worker_rates to service_role;
create policy workers_read on public.workers for select to authenticated using(private.has_role(array['owner','office']) or (user_id=auth.uid() and private.has_role(array['worker','crew_lead'])));
create policy workers_edit on public.workers for update to authenticated using(private.has_role(array['owner','office'])) with check(private.has_role(array['owner','office']));
create policy rates_read on public.worker_rates for select to authenticated using(private.has_role(array['owner','office']) or (user_id=auth.uid() and private.has_role(array['worker','crew_lead'])));
create policy rates_insert on public.worker_rates for insert to authenticated with check(private.has_role(array['owner','office']));
insert into public.workers(user_id,full_name,email)
 select m.user_id,left(coalesce(nullif(u.raw_user_meta_data->>'full_name',''),u.email,'Trabajador'),100),coalesce(u.email,m.user_id::text)
 from public.memberships m join auth.users u on u.id=m.user_id where m.role in ('worker','crew_lead');

create function public.provision_worker(p_user_id uuid,p_name text,p_email text,p_phone text,p_rate numeric,p_effective date) returns public.workers language plpgsql security invoker set search_path='' as $$
declare result public.workers;
begin
 insert into public.memberships(user_id,role) values(p_user_id,'worker');
 insert into public.workers(user_id,full_name,email,phone) values(p_user_id,p_name,p_email,p_phone) returning * into result;
 insert into public.worker_rates(user_id,effective_date,hourly_rate) values(p_user_id,p_effective,p_rate);
 return result;
end; $$;
revoke all on function public.provision_worker(uuid,text,text,text,numeric,date) from public,anon,authenticated;
grant execute on function public.provision_worker(uuid,text,text,text,numeric,date) to service_role;

create function public.set_project_workers(p_project_id uuid,p_worker_ids uuid[]) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not private.has_role(array['owner','office']) then raise exception 'Office access required'; end if;
 perform 1 from public.projects where id=p_project_id for update;
 if not found then raise exception 'Project unavailable'; end if;
 if exists(select 1 from unnest(p_worker_ids) x where not exists(select 1 from public.workers w join public.memberships m on m.user_id=w.user_id where w.user_id=x and m.active and m.role in ('worker','crew_lead'))) then raise exception 'Worker unavailable'; end if;
 delete from public.assignments where project_id=p_project_id;
 insert into public.assignments(project_id,user_id) select p_project_id,x from (select distinct unnest(p_worker_ids) x) ids;
end; $$;
-- Office must see worker membership when validating assignments, without exposing other memberships to workers.
create policy memberships_office_read on public.memberships for select to authenticated using(private.has_role(array['owner','office']));
revoke all on function public.set_project_workers(uuid,uuid[]) from public,anon;
grant execute on function public.set_project_workers(uuid,uuid[]) to authenticated;

create function public.create_project_with_workers(p_project jsonb,p_worker_ids uuid[]) returns public.projects language plpgsql security invoker set search_path='' as $$
declare result public.projects;
begin
 if not private.has_role(array['owner','office']) then raise exception 'Office access required'; end if;
 insert into public.projects(name,builder,builder_id,contact_id,address,address_source,address_ref,latitude,longitude,address_review_note,target_date,project_type,work_type,priority,lot_unit,zone,notes,access_notes,planned_start)
 values(p_project->>'name',p_project->>'builder',(p_project->>'builder_id')::uuid,(p_project->>'contact_id')::uuid,p_project->>'address',p_project->>'address_source',p_project->>'address_ref',(p_project->>'latitude')::double precision,(p_project->>'longitude')::double precision,p_project->>'address_review_note',(p_project->>'target_date')::date,p_project->>'project_type',p_project->>'work_type',coalesce(p_project->>'priority','normal'),coalesce(p_project->>'lot_unit',''),coalesce(p_project->>'zone',''),coalesce(p_project->>'notes',''),coalesce(p_project->>'access_notes',''),(p_project->>'planned_start')::date) returning * into result;
 perform public.set_project_workers(result.id,p_worker_ids);
 return result;
end; $$;
revoke all on function public.create_project_with_workers(jsonb,uuid[]) from public,anon;
grant execute on function public.create_project_with_workers(jsonb,uuid[]) to authenticated;

alter table public.field_reports add column work_date date;
update public.field_reports set work_date=(created_at at time zone 'America/Mexico_City')::date;
alter table public.field_reports alter column work_date set not null, alter column work_date set default ((now() at time zone 'America/Mexico_City')::date);
create index reports_worker_week_idx on public.field_reports(author_id,work_date);
create function private.bind_worker_report() returns trigger language plpgsql security invoker set search_path='' as $$
declare worker_name text; used_hours numeric;
begin
 if new.author_id is distinct from auth.uid() then raise exception 'Report must belong to signed-in user'; end if;
 if private.has_role(array['worker','crew_lead']) then
  select full_name into worker_name from public.workers where user_id=auth.uid();
  if worker_name is null then raise exception 'Worker profile required'; end if;
  if not exists(select 1 from public.assignments where project_id=new.project_id and user_id=auth.uid()) then raise exception 'Project not assigned'; end if;
  new.author_name=worker_name;
 elsif private.has_role(array['owner','office']) then new.author_name='Oficina';
 else raise exception 'Active account required'; end if;
 if new.work_date>(now() at time zone 'America/Mexico_City')::date then raise exception 'Future work date not allowed'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.author_id::text||new.work_date::text,0));
 select coalesce(sum(hours),0) into used_hours from public.field_reports where author_id=new.author_id and work_date=new.work_date;
 if used_hours+new.hours>24 then raise exception 'More than 24 hours for this date'; end if;
 return new;
end; $$;
revoke all on function private.bind_worker_report() from public,anon;
create trigger bind_worker_report before insert on public.field_reports for each row execute function private.bind_worker_report();
commit;
