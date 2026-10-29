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
