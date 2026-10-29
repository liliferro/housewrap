begin;
alter table public.estimates add column measurements jsonb;
create function private.measurement_area(m jsonb) returns numeric language plpgsql immutable security invoker set search_path='' as $$
declare r jsonb; w numeric; h numeric; q numeric; rw numeric; rl numeric; total numeric:=0; factor numeric:=1;
begin
 if jsonb_typeof(m)<>'object' or m->>'version'<>'1' or m->'reviewed'<>'true'::jsonb or m->>'units' not in ('ft','m') or jsonb_typeof(m->'rows')<>'array' or jsonb_array_length(m->'rows') not between 1 and 100 or jsonb_typeof(m->'reference')<>'string' or length(m->>'reference')>200 then raise exception 'Invalid measurements'; end if;
 if m->>'units' is null or m->>'version' is null or m->'reviewed' is null or m->'rows' is null or m->'reference' is null then raise exception 'Missing measurement fields'; end if;
 if jsonb_typeof(m->'roll_width_ft') is distinct from 'number' or jsonb_typeof(m->'roll_length_ft') is distinct from 'number' then raise exception 'Invalid roll dimensions'; end if;
 rw:=(m->>'roll_width_ft')::numeric;rl:=(m->>'roll_length_ft')::numeric;
 if rw<=0 or rw>100 or rl<=0 or rl>1000 or round(rw*rl,2)<0.01 then raise exception 'Invalid roll dimensions'; end if;
 for r in select value from jsonb_array_elements(m->'rows') loop
  if jsonb_typeof(r->'width') is distinct from 'number' or jsonb_typeof(r->'height') is distinct from 'number' or jsonb_typeof(r->'quantity') is distinct from 'number' or jsonb_typeof(r->'label') is distinct from 'string' or length(r->>'label')>100 or coalesce(r->>'shape','') not in ('rectangle','triangle') then raise exception 'Invalid wall'; end if;
  w:=(r->>'width')::numeric;h:=(r->>'height')::numeric;q:=(r->>'quantity')::numeric;
  if w<=0 or w>10000 or h<=0 or h>10000 or q<1 or q>100 or mod(q,1)<>0 then raise exception 'Invalid wall dimensions'; end if;
  total:=total+w*h*q*(case when r->>'shape'='triangle' then 0.5 else 1 end);
 end loop;
 if m->>'units'='m' then factor:=1250.0/381; end if;
 total:=round(total*factor*factor,2);
 if total<0.01 or total>1000000 then raise exception 'Area outside allowed range'; end if;
 return total;
end; $$;
revoke all on function private.measurement_area(jsonb) from public,anon;
grant execute on function private.measurement_area(jsonb) to authenticated;
create function private.enforce_estimate_measurements() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.measurements is not null then
  new.area:=private.measurement_area(new.measurements);
  new.roll_size:=round((new.measurements->>'roll_width_ft')::numeric*(new.measurements->>'roll_length_ft')::numeric,2);
 end if;
 return new;
end; $$;
revoke all on function private.enforce_estimate_measurements() from public,anon;
create trigger enforce_estimate_measurements before insert or update on public.estimates for each row execute function private.enforce_estimate_measurements();
grant insert(measurements) on public.estimates to authenticated;
create function public.create_estimate_from_measurements(p_project_id uuid,p_measurements jsonb,p_rate numeric,p_waste numeric) returns public.estimates language plpgsql security invoker set search_path='' as $$
declare result public.estimates;
begin
 insert into public.estimates(project_id,area,rate,waste,roll_size,measurements)
 values(p_project_id,private.measurement_area(p_measurements),p_rate,p_waste,1,p_measurements) returning * into result;
 return result;
end; $$;
revoke all on function public.create_estimate_from_measurements(uuid,jsonb,numeric,numeric) from public,anon;
grant execute on function public.create_estimate_from_measurements(uuid,jsonb,numeric,numeric) to authenticated;
commit;
