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
