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
