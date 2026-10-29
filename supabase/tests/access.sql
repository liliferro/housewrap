-- Run after foundation migration. Fixtures are always rolled back.
begin;
insert into auth.users(id,email) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa-owner@example.invalid'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','qa-worker@example.invalid'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','qa-office@example.invalid');
insert into public.memberships(user_id,role) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','worker'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','office');
insert into public.projects(id,name,builder,address) values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Assigned QA','Builder QA','Atlanta'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Hidden QA','Builder QA','Atlanta');
insert into public.assignments values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$ begin
 if (select count(*) from public.projects)<>1 then raise exception 'Worker project isolation failed'; end if;
 if exists(select 1 from public.estimates) then raise exception 'Worker estimate isolation failed'; end if;
 begin
  insert into public.projects(name,builder,address) values('Unauthorized','Builder','Atlanta');
  raise exception 'Worker could create project';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.field_reports(id,project_id,author_id,notes,hours,rolls) values(gen_random_uuid(),'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',auth.uid(),'Must be denied',8,2);
  raise exception 'Worker reported on unassigned project';
 exception when insufficient_privilege then null; end;
end; $$;
insert into public.field_reports(id,project_id,author_id,notes,hours,rolls) values('ffffffff-ffff-4fff-8fff-ffffffffffff','dddddddd-dddd-4ddd-8ddd-dddddddddddd',auth.uid(),'North wall completed',8,2);
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
select public.create_estimate('dddddddd-dddd-4ddd-8ddd-dddddddddddd',2400,1.25,8,1350);
do $$ declare eid uuid; begin
 select id into eid from public.estimates where project_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 begin
  perform public.approve_estimate(eid);
  raise exception 'Office could approve';
 exception when raise_exception then
  if sqlerrm='Office could approve' then raise; end if;
 end;
end; $$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select public.approve_estimate(id) from public.estimates where project_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$ begin
 if not exists(select 1 from public.estimates where project_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' and total=3000 and rolls=2 and status='approved' and approved_by=auth.uid()) then raise exception 'Calculation or approval failed'; end if;
 begin
  update public.estimates set total=1 where project_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  raise exception 'Total override allowed';
 exception when insufficient_privilege or generated_always then null; end;
end; $$;
reset role;
rollback;
