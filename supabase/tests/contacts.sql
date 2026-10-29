-- Requires an existing active owner; all fixtures are rolled back.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.memberships where role='owner' and active limit 1),true);
set local role authenticated;
do $$ declare b uuid; c uuid; other_b uuid; begin
 insert into public.builders(name) values('QA '||gen_random_uuid()) returning id into b;
 insert into public.builders(name) values('QA Other '||gen_random_uuid()) returning id into other_b;
 insert into public.contacts(builder_id,name,phone) values(b,'QA Phone','4045550101') returning id into c;
 insert into public.projects(name,builder,address,builder_id,contact_id) values('QA One','QA','Atlanta',b,c),('QA Two','QA','Atlanta',b,c);
 update public.contacts set phone=null,email='qa@example.com' where id=c;
 if (select count(*) from public.projects where contact_id=c)<>2 then raise exception 'Reuse failed'; end if;
 begin
  insert into public.projects(name,builder,address,builder_id,contact_id) values('QA Invalid','QA','Atlanta',other_b,c);
  raise exception 'Mismatch was allowed';
 exception when foreign_key_violation then null;
 end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.builders) or exists(select 1 from public.contacts) then raise exception 'Directory exposed to non-member'; end if;
 begin
  insert into public.builders(name) values('Forbidden QA');
  raise exception 'Write exposed';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
