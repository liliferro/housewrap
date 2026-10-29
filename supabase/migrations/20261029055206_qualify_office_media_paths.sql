begin;
drop policy progress_media_read on storage.objects;
create policy progress_media_read on storage.objects for select to authenticated using (
 bucket_id='progress-media' and exists(select 1 from public.projects p where p.id::text=(storage.foldername(storage.objects.name))[2]) and
 (private.has_role(array['owner','office']) or (private.has_role(array['worker','crew_lead']) and
 ((storage.foldername(storage.objects.name))[1]=(select auth.uid())::text or exists(select 1 from public.field_reports r where r.id::text=(storage.foldername(storage.objects.name))[3] and r.author_id=(select auth.uid()) and r.attachments @> jsonb_build_array(jsonb_build_object('path',storage.objects.name))))))
);
commit;
