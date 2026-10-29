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
