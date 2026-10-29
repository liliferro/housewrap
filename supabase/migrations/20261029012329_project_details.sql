alter table public.projects
 add column project_type text check(project_type in ('single_family','multi_family','commercial','other')),
 add column work_type text check(work_type in ('new_construction','remodel','repair','other')),
 add column priority text not null default 'normal' check(priority in ('normal','high','urgent')),
 add column lot_unit text not null default '' check(length(lot_unit)<=80),
 add column notes text not null default '' check(length(notes)<=3000),
 add column access_notes text not null default '' check(length(access_notes)<=1000),
 add column planned_start date,
 add constraint project_planned_dates_order check(planned_start is null or target_date is null or planned_start<=target_date);
