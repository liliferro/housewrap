alter table public.projects add column zone text not null default '' check (length(zone) <= 120);
