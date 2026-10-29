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
