-- Housewrap foundation. Apply as a single transaction to a dedicated project.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','office','crew_lead','worker')),
 active boolean not null default true
);
alter table public.memberships enable row level security;
grant select on public.memberships to authenticated;
create policy membership_self on public.memberships for select to authenticated using (user_id=(select auth.uid()) and active);

-- Private authorization lookup must inspect memberships without recursive RLS.
create function private.has_role(allowed text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.memberships where user_id=auth.uid() and active and role=any(allowed));
$$;
revoke all on function private.has_role(text[]) from public,anon;
grant execute on function private.has_role(text[]) to authenticated;

create table public.projects (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 100),
 builder text not null check(length(trim(builder)) between 2 and 100),
 address text not null check(length(trim(address)) between 3 and 200),
 status text not null default 'scheduled' check(status in ('scheduled','active','done')),
 target_date date,
 created_at timestamptz not null default now()
);
create table public.assignments (
 project_id uuid not null references public.projects(id) on delete cascade,
 user_id uuid not null references public.memberships(user_id) on delete cascade,
 primary key(project_id,user_id)
);
create index assignments_user_idx on public.assignments(user_id);
alter table public.projects enable row level security;
alter table public.assignments enable row level security;
grant select,insert,update on public.projects to authenticated;
grant select,insert,update,delete on public.assignments to authenticated;
create policy assignments_read on public.assignments for select to authenticated using(user_id=(select auth.uid()) or private.has_role(array['owner','office']));
create policy assignments_manage on public.assignments for all to authenticated using(private.has_role(array['owner','office'])) with check(private.has_role(array['owner','office']));
create policy projects_read on public.projects for select to authenticated using(private.has_role(array['owner','office']) or (private.has_role(array['crew_lead','worker']) and exists(select 1 from public.assignments a where a.project_id=id and a.user_id=(select auth.uid()))));
create policy projects_insert on public.projects for insert to authenticated with check(private.has_role(array['owner','office']));
create policy projects_update on public.projects for update to authenticated using(private.has_role(array['owner','office'])) with check(private.has_role(array['owner','office']));

create table public.estimates (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id),
 area numeric(12,2) not null check(area>0 and area<=1000000),
 rate numeric(12,2) not null check(rate>0 and rate<=10000),
 waste numeric(5,2) not null check(waste between 0 and 50),
 roll_size numeric(12,2) not null check(roll_size>0 and roll_size<=100000),
 rolls integer generated always as (ceil(area*(1+waste/100)/roll_size)::integer) stored,
 total numeric(16,2) generated always as (round(area*rate,2)) stored,
 status text not null default 'draft' check(status in ('draft','approved')),
 created_by uuid not null default auth.uid() references auth.users(id),
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 created_at timestamptz not null default now()
);
create index estimates_project_idx on public.estimates(project_id);
alter table public.estimates enable row level security;
grant select on public.estimates to authenticated;
grant insert(project_id,area,rate,waste,roll_size) on public.estimates to authenticated;
grant update(status) on public.estimates to authenticated;
create policy estimates_read on public.estimates for select to authenticated using(private.has_role(array['owner','office']));
create policy estimates_insert on public.estimates for insert to authenticated with check(private.has_role(array['owner','office']) and status='draft' and created_by=(select auth.uid()) and approved_by is null and approved_at is null);
create policy estimates_approve on public.estimates for update to authenticated using(private.has_role(array['owner']) and status='draft') with check(private.has_role(array['owner']) and status='approved');
create function private.stamp_estimate_approval() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.status<>'draft' or new.status<>'approved' or not private.has_role(array['owner']) then raise exception 'Only the owner can approve a draft'; end if;
 new.approved_by:=auth.uid(); new.approved_at:=now(); return new;
end; $$;
revoke all on function private.stamp_estimate_approval() from public,anon;
create trigger stamp_approval before update on public.estimates for each row execute function private.stamp_estimate_approval();

create function public.create_estimate(p_project_id uuid,p_area numeric,p_rate numeric,p_waste numeric,p_roll_size numeric)
returns public.estimates language plpgsql security invoker set search_path='' as $$
declare result public.estimates;
begin
 insert into public.estimates(project_id,area,rate,waste,roll_size) values(p_project_id,p_area,p_rate,p_waste,p_roll_size) returning * into result;
 return result;
end; $$;
create function public.approve_estimate(p_id uuid) returns public.estimates
language plpgsql security invoker set search_path='' as $$
declare result public.estimates;
begin
 update public.estimates set status='approved' where id=p_id and status='draft' returning * into result;
 if not found then raise exception 'Draft not found or approval not permitted'; end if;
 return result;
end; $$;
revoke all on function public.create_estimate(uuid,numeric,numeric,numeric,numeric) from public,anon;
revoke all on function public.approve_estimate(uuid) from public,anon;
grant execute on function public.create_estimate(uuid,numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.approve_estimate(uuid) to authenticated;

create table public.field_reports (
 id uuid primary key,
 project_id uuid not null references public.projects(id),
 author_id uuid not null references auth.users(id),
 notes text not null check(length(trim(notes)) between 5 and 2000),
 hours numeric(5,2) not null check(hours between 0 and 24),
 rolls numeric(6,2) not null check(rolls between 0 and 100),
 created_at timestamptz not null default now()
);
create index reports_project_idx on public.field_reports(project_id);
create index reports_author_idx on public.field_reports(author_id);
alter table public.field_reports enable row level security;
grant select,insert on public.field_reports to authenticated;
create policy reports_read on public.field_reports for select to authenticated using(private.has_role(array['owner','office']) or (author_id=(select auth.uid()) and private.has_role(array['worker','crew_lead'])));
create policy reports_insert on public.field_reports for insert to authenticated with check(author_id=(select auth.uid()) and (private.has_role(array['owner','office']) or (private.has_role(array['worker','crew_lead']) and exists(select 1 from public.assignments a where a.project_id=field_reports.project_id and a.user_id=(select auth.uid())))));
commit;

-- Builder directory extension
begin;
create table public.builders (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 100),
 created_at timestamptz not null default now()
);
create unique index builders_name_unique on public.builders(lower(trim(name)));
create table public.contacts (
 id uuid primary key default gen_random_uuid(),
 builder_id uuid not null references public.builders(id),
 name text not null check(length(trim(name)) between 2 and 100),
 email text check(email is null or (length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 phone text check(phone is null or length(trim(phone)) between 3 and 40),
 created_at timestamptz not null default now(),
 unique(id,builder_id)
);
create index contacts_builder_idx on public.contacts(builder_id);
alter table public.projects add column builder_id uuid references public.builders(id), add column contact_id uuid;
alter table public.projects add constraint project_contact_builder_fk foreign key(contact_id,builder_id) references public.contacts(id,builder_id);
alter table public.projects add constraint project_contact_requires_builder check(contact_id is null or builder_id is not null);
create index projects_builder_idx on public.projects(builder_id);
create index projects_contact_builder_idx on public.projects(contact_id,builder_id);
-- Preserve existing works and their builder names. No invented contact people.
insert into public.builders(name) select min(trim(builder)) from public.projects group by lower(trim(builder));
update public.projects p set builder_id=b.id from public.builders b where lower(trim(p.builder))=lower(trim(b.name));
alter table public.builders enable row level security;
alter table public.contacts enable row level security;
revoke all on public.builders,public.contacts from anon,authenticated;
grant select,insert on public.builders,public.contacts to authenticated;
grant update(name) on public.builders to authenticated;
grant update(name,email,phone) on public.contacts to authenticated;
create policy builders_read on public.builders for select to authenticated using(private.has_role(array['owner','office']) or exists(select 1 from public.projects p where p.builder_id=builders.id));
create policy builders_insert on public.builders for insert to authenticated with check(private.has_role(array['owner','office']));
create policy builders_update on public.builders for update to authenticated using(private.has_role(array['owner','office'])) with check(private.has_role(array['owner','office']));
create policy contacts_read on public.contacts for select to authenticated using(private.has_role(array['owner','office']) or exists(select 1 from public.projects p where p.contact_id=contacts.id));
create policy contacts_insert on public.contacts for insert to authenticated with check(private.has_role(array['owner','office']));
create policy contacts_update on public.contacts for update to authenticated using(private.has_role(array['owner','office'])) with check(private.has_role(array['owner','office']));

commit;

-- Per-project dashboard
begin;
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

commit;

-- Address selection metadata; existing rows stay unverified.
begin;
alter table public.projects
 add column address_source text check(address_source in ('photon','manual')),
 add column address_ref text check(length(address_ref)<=100),
 add column latitude double precision check(latitude between -90 and 90),
 add column longitude double precision check(longitude between -180 and 180),
 add column address_review_note text check(length(address_review_note)<=500),
 add constraint project_address_selection check(address_source is distinct from 'photon' or (address_ref is not null and latitude is not null and longitude is not null)),
 add constraint project_address_manual_note check(address_source is distinct from 'manual' or (address_review_note is not null and length(trim(address_review_note))>=10));

commit;

-- Project classification and shared site notes
begin;
alter table public.projects
 add column project_type text check(project_type in ('single_family','multi_family','commercial','other')),
 add column work_type text check(work_type in ('new_construction','remodel','repair','other')),
 add column priority text not null default 'normal' check(priority in ('normal','high','urgent')),
 add column lot_unit text not null default '' check(length(lot_unit)<=80),
 add column notes text not null default '' check(length(notes)<=3000),
 add column access_notes text not null default '' check(length(access_notes)<=1000),
 add column planned_start date,
 add constraint project_planned_dates_order check(planned_start is null or target_date is null or planned_start<=target_date);

commit;

-- Private progress photos and audio
begin;
alter table public.field_reports add column attachments jsonb not null default '[]'::jsonb;
alter table public.field_reports drop constraint field_reports_notes_check;
alter table public.field_reports add constraint progress_content_check check(length(trim(notes))<=2000 and (length(trim(notes))>=5 or (jsonb_typeof(attachments)='array' and jsonb_array_length(attachments) between 1 and 6)));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('progress-media','progress-media',false,10485760,array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-wav','audio/aac']);
create policy progress_media_read on storage.objects for select to authenticated using(bucket_id='progress-media' and exists(select 1 from public.projects p where p.id::text=(storage.foldername(name))[2]) and (private.has_role(array['owner','office']) or ((storage.foldername(name))[1]=(select auth.uid())::text and private.has_role(array['worker','crew_lead']))));
create policy progress_media_upload on storage.objects for insert to authenticated with check(bucket_id='progress-media' and (storage.foldername(name))[1]=(select auth.uid())::text and array_length(storage.foldername(name),1)=3 and private.has_role(array['owner','office','worker','crew_lead']) and exists(select 1 from public.projects p where p.id::text=(storage.foldername(name))[2]) and not exists(select 1 from public.field_reports r where r.id::text=(storage.foldername(name))[3]));
create policy progress_media_remove_draft on storage.objects for delete to authenticated using(bucket_id='progress-media' and (storage.foldername(name))[1]=(select auth.uid())::text and private.has_role(array['owner','office','worker','crew_lead']) and not exists(select 1 from public.field_reports r where r.id::text=(storage.foldername(name))[3]));
create function private.validate_progress_media() returns trigger language plpgsql security invoker set search_path='' as $$
declare item jsonb; total_bytes bigint:=0; photos integer:=0; audios integer:=0;
begin
 if jsonb_typeof(new.attachments)<>'array' or jsonb_array_length(new.attachments)>6 then raise exception 'Invalid attachments'; end if;
 for item in select value from jsonb_array_elements(new.attachments) loop
  if item->>'path' is null or item->>'mime' is null or item->>'name' is null or length(item->>'name')>160 or item->>'size' is null then raise exception 'Invalid attachment metadata'; end if;
  if (item->>'size')::bigint not between 1 and 10485760 then raise exception 'File too large'; end if;
  total_bytes:=total_bytes+(item->>'size')::bigint;
  if item->>'mime' in ('image/jpeg','image/png','image/webp') then photos:=photos+1;
  elsif item->>'mime' in ('audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-wav','audio/aac') then audios:=audios+1;
  else raise exception 'Unsupported media'; end if;
  if split_part(item->>'path','/',1)<>new.author_id::text or split_part(item->>'path','/',2)<>new.project_id::text or split_part(item->>'path','/',3)<>new.id::text or array_length(string_to_array(item->>'path','/'),1)<>4 then raise exception 'Invalid media path'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='progress-media' and o.name=item->>'path' and (o.metadata->>'size')::bigint=(item->>'size')::bigint and o.metadata->>'mimetype'=item->>'mime') then raise exception 'Upload not found'; end if;
 end loop;
 if total_bytes>31457280 or photos>5 or audios>1 then raise exception 'Too many attachments'; end if;
 return new;
end $$;
revoke all on function private.validate_progress_media() from public,anon;
create trigger validate_progress_media before insert on public.field_reports for each row execute function private.validate_progress_media();

commit;

begin;
drop policy progress_media_read on storage.objects;
drop policy progress_media_upload on storage.objects;
drop policy progress_media_remove_draft on storage.objects;
create policy progress_media_read on storage.objects for select to authenticated using(bucket_id='progress-media' and exists(select 1 from public.projects p where p.id::text=(storage.foldername(storage.objects.name))[2]) and (private.has_role(array['owner','office']) or ((storage.foldername(storage.objects.name))[1]=(select auth.uid())::text and private.has_role(array['worker','crew_lead']))));
create policy progress_media_upload on storage.objects for insert to authenticated with check(bucket_id='progress-media' and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text and array_length(storage.foldername(storage.objects.name),1)=3 and private.has_role(array['owner','office','worker','crew_lead']) and exists(select 1 from public.projects p where p.id::text=(storage.foldername(storage.objects.name))[2]) and not exists(select 1 from public.field_reports r where r.id::text=(storage.foldername(storage.objects.name))[3]));
create policy progress_media_remove_draft on storage.objects for delete to authenticated using(bucket_id='progress-media' and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text and private.has_role(array['owner','office','worker','crew_lead']) and not exists(select 1 from public.field_reports r where r.id::text=(storage.foldername(storage.objects.name))[3]));

commit;

-- Operational zone shared by works and estimates
alter table public.projects add column zone text not null default '' check (length(zone) <= 120);

begin;
alter table public.projects add column pipeline_stage text not null default 'received'
 check(pipeline_stage in ('received','to_quote','quoted','sent','reminder_1','reminder_2','won','lost'));
alter table public.projects add column pipeline_changed_at timestamptz;
update public.projects p set pipeline_stage='quoted' where exists(select 1 from public.estimates e where e.project_id=p.id);
create function private.stamp_pipeline_stage() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.pipeline_stage is distinct from old.pipeline_stage then new.pipeline_changed_at=now(); end if;
 return new;
end; $$;
revoke all on function private.stamp_pipeline_stage() from public,anon;
create trigger stamp_pipeline_stage before update on public.projects for each row execute function private.stamp_pipeline_stage();
create function private.advance_pipeline_after_estimate() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 update public.projects set pipeline_stage='quoted' where id=new.project_id and pipeline_stage in ('received','to_quote');
 return new;
end; $$;
revoke all on function private.advance_pipeline_after_estimate() from public,anon;
create trigger advance_pipeline_after_estimate after insert on public.estimates for each row execute function private.advance_pipeline_after_estimate();
commit;

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
revoke update on public.field_reports from public,anon,authenticated;
grant update(review_status,review_note) on public.field_reports to authenticated;

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

begin;
alter table public.estimates add column measurements jsonb;
create function private.measurement_area(m jsonb) returns numeric language plpgsql immutable security invoker set search_path='' as $$
declare r jsonb; w numeric; h numeric; q numeric; rw numeric; rl numeric; total numeric:=0; factor numeric:=1;
begin
 if jsonb_typeof(m)<>'object' or m->>'version'<>'1' or m->'reviewed'<>'true'::jsonb or m->>'units' not in ('ft','m') or jsonb_typeof(m->'rows')<>'array' or jsonb_array_length(m->'rows') not between 1 and 100 or jsonb_typeof(m->'reference')<>'string' or length(m->>'reference')>200 then raise exception 'Invalid measurements'; end if;
 if m->>'units' is null or m->>'version' is null or m->'reviewed' is null or m->'rows' is null or m->'reference' is null then raise exception 'Missing measurement fields'; end if;
 if jsonb_typeof(m->'roll_width_ft') is distinct from 'number' or jsonb_typeof(m->'roll_length_ft') is distinct from 'number' then raise exception 'Invalid roll dimensions'; end if;
 rw:=(m->>'roll_width_ft')::numeric;rl:=(m->>'roll_length_ft')::numeric;
 if rw<=0 or rw>100 or rl<=0 or rl>1000 or round(rw*rl,2)<0.01 then raise exception 'Invalid roll dimensions'; end if;
 for r in select value from jsonb_array_elements(m->'rows') loop
  if jsonb_typeof(r->'width') is distinct from 'number' or jsonb_typeof(r->'height') is distinct from 'number' or jsonb_typeof(r->'quantity') is distinct from 'number' or jsonb_typeof(r->'label') is distinct from 'string' or length(r->>'label')>100 or coalesce(r->>'shape','') not in ('rectangle','triangle') then raise exception 'Invalid wall'; end if;
  w:=(r->>'width')::numeric;h:=(r->>'height')::numeric;q:=(r->>'quantity')::numeric;
  if w<=0 or w>10000 or h<=0 or h>10000 or q<1 or q>100 or mod(q,1)<>0 then raise exception 'Invalid wall dimensions'; end if;
  total:=total+w*h*q*(case when r->>'shape'='triangle' then 0.5 else 1 end);
 end loop;
 if m->>'units'='m' then factor:=1250.0/381; end if;
 total:=round(total*factor*factor,2);
 if total<0.01 or total>1000000 then raise exception 'Area outside allowed range'; end if;
 return total;
end; $$;
revoke all on function private.measurement_area(jsonb) from public,anon;
grant execute on function private.measurement_area(jsonb) to authenticated;
create function private.enforce_estimate_measurements() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.measurements is not null then
  new.area:=private.measurement_area(new.measurements);
  new.roll_size:=round((new.measurements->>'roll_width_ft')::numeric*(new.measurements->>'roll_length_ft')::numeric,2);
 end if;
 return new;
end; $$;
revoke all on function private.enforce_estimate_measurements() from public,anon;
create trigger enforce_estimate_measurements before insert or update on public.estimates for each row execute function private.enforce_estimate_measurements();
grant insert(measurements) on public.estimates to authenticated;
create function public.create_estimate_from_measurements(p_project_id uuid,p_measurements jsonb,p_rate numeric,p_waste numeric) returns public.estimates language plpgsql security invoker set search_path='' as $$
declare result public.estimates;
begin
 insert into public.estimates(project_id,area,rate,waste,roll_size,measurements)
 values(p_project_id,private.measurement_area(p_measurements),p_rate,p_waste,1,p_measurements) returning * into result;
 return result;
end; $$;
revoke all on function public.create_estimate_from_measurements(uuid,jsonb,numeric,numeric) from public,anon;
grant execute on function public.create_estimate_from_measurements(uuid,jsonb,numeric,numeric) to authenticated;
commit;

begin;
alter table public.field_reports add column submitted_by uuid references auth.users(id);
update public.field_reports set submitted_by=author_id;
alter table public.field_reports alter column submitted_by set not null;
grant insert(submitted_by) on public.field_reports to authenticated;
create or replace function private.bind_worker_report() returns trigger language plpgsql security invoker set search_path='' as $$
declare worker_name text; used_hours numeric;
begin
 new.submitted_by:=auth.uid();
 if not private.has_role(array['owner','office']) then
  if not private.has_role(array['worker','crew_lead']) or new.author_id is distinct from auth.uid() then raise exception 'Report must belong to signed-in worker'; end if;
 end if;
 select full_name into worker_name from public.workers where user_id=new.author_id;
 if worker_name is null then raise exception 'Registered worker required'; end if;
 if not exists(select 1 from public.assignments where project_id=new.project_id and user_id=new.author_id) then raise exception 'Worker not assigned to project'; end if;
 new.author_name:=worker_name;
 if new.work_date>(now() at time zone 'America/Mexico_City')::date then raise exception 'Future work date not allowed'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.author_id::text||new.work_date::text,0));
 select coalesce(sum(hours),0) into used_hours from public.field_reports where author_id=new.author_id and work_date=new.work_date;
 if used_hours+new.hours>24 then raise exception 'More than 24 hours for this date'; end if;
 return new;
end; $$;

drop policy reports_insert on public.field_reports;
create policy reports_insert on public.field_reports for insert to authenticated with check(
 submitted_by=(select auth.uid()) and
 (private.has_role(array['owner','office']) or (author_id=(select auth.uid()) and private.has_role(array['worker','crew_lead']))) and
 exists(select 1 from public.workers w where w.user_id=author_id) and
 exists(select 1 from public.assignments a where a.project_id=field_reports.project_id and a.user_id=author_id)
);
create or replace function private.validate_progress_media() returns trigger language plpgsql security invoker set search_path='' as $$
declare item jsonb; total_bytes bigint:=0; photos integer:=0; audios integer:=0;
begin
 if jsonb_typeof(new.attachments)<>'array' or jsonb_array_length(new.attachments)>6 then raise exception 'Invalid attachments'; end if;
 for item in select value from jsonb_array_elements(new.attachments) loop
  if item->>'path' is null or item->>'mime' is null or item->>'name' is null or length(item->>'name')>160 or item->>'size' is null then raise exception 'Invalid attachment metadata'; end if;
  if (item->>'size')::bigint not between 1 and 10485760 then raise exception 'File too large'; end if;
  total_bytes:=total_bytes+(item->>'size')::bigint;
  if item->>'mime' in ('image/jpeg','image/png','image/webp') then photos:=photos+1;
  elsif item->>'mime' in ('audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-wav','audio/aac') then audios:=audios+1;
  else raise exception 'Unsupported media'; end if;
  if split_part(item->>'path','/',1)<>coalesce(new.submitted_by,new.author_id)::text or split_part(item->>'path','/',2)<>new.project_id::text or split_part(item->>'path','/',3)<>new.id::text or array_length(string_to_array(item->>'path','/'),1)<>4 then raise exception 'Invalid media path'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='progress-media' and o.name=item->>'path' and (o.metadata->>'size')::bigint=(item->>'size')::bigint and o.metadata->>'mimetype'=item->>'mime') then raise exception 'Upload not found'; end if;
 end loop;
 if total_bytes>31457280 or photos>5 or audios>1 then raise exception 'Too many attachments'; end if;
 return new;
end $$;

drop policy progress_media_read on storage.objects;
create policy progress_media_read on storage.objects for select to authenticated using (
 bucket_id='progress-media' and exists(select 1 from public.projects p where p.id::text=(storage.foldername(name))[2]) and
 (private.has_role(array['owner','office']) or (private.has_role(array['worker','crew_lead']) and
 ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.field_reports r where r.id::text=(storage.foldername(name))[3] and r.author_id=(select auth.uid()) and r.attachments @> jsonb_build_array(jsonb_build_object('path',name))))))
);
commit;

begin;
drop policy progress_media_read on storage.objects;
create policy progress_media_read on storage.objects for select to authenticated using (
 bucket_id='progress-media' and exists(select 1 from public.projects p where p.id::text=(storage.foldername(storage.objects.name))[2]) and
 (private.has_role(array['owner','office']) or (private.has_role(array['worker','crew_lead']) and
 ((storage.foldername(storage.objects.name))[1]=(select auth.uid())::text or exists(select 1 from public.field_reports r where r.id::text=(storage.foldername(storage.objects.name))[3] and r.author_id=(select auth.uid()) and r.attachments @> jsonb_build_array(jsonb_build_object('path',storage.objects.name))))))
);
commit;
