begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.memberships where role='owner' and active limit 1),true);
set local role authenticated;
do $$ declare p uuid; other_p uuid; e public.estimates; begin
 insert into public.projects(name,builder,address) values('QA Dashboard','QA Builder','Atlanta') returning id into p;
 insert into public.projects(name,builder,address) values('QA Other','QA Builder','Atlanta') returning id into other_p;
 select * into e from public.create_estimate(p,100,2,5,50);
 begin update public.projects set quoted_estimate_id=e.id where id=p; raise exception 'Draft accepted'; exception when raise_exception then if SQLERRM='Draft accepted' then raise; end if; end;
 perform public.approve_estimate(e.id);
 update public.projects set quoted_estimate_id=e.id,progress=40,started_at='2026-10-28T08:00:00Z',finished_at='2026-10-28T18:00:00Z' where id=p;
 begin update public.projects set quoted_estimate_id=e.id where id=other_p; raise exception 'Wrong project accepted'; exception when raise_exception then if SQLERRM='Wrong project accepted' then raise; end if; end;
 begin update public.projects set progress=101 where id=p; raise exception 'Invalid progress accepted'; exception when check_violation then null; end;
 begin update public.projects set finished_at='2026-10-27T08:00:00Z' where id=p; raise exception 'Invalid date accepted'; exception when check_violation then null; end;
 insert into public.field_reports(id,project_id,author_id,author_name,notes,hours,rolls) values(gen_random_uuid(),p,auth.uid(),'QA Worker','Complete north wall',2.5,1.25);
 if (select sum(hours) from public.field_reports where project_id=p)<>2.5 then raise exception 'Hours mismatch'; end if;
end $$;
rollback;
