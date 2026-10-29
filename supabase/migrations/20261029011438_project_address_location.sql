alter table public.projects
 add column address_source text check(address_source in ('photon','manual')),
 add column address_ref text check(length(address_ref)<=100),
 add column latitude double precision check(latitude between -90 and 90),
 add column longitude double precision check(longitude between -180 and 180),
 add column address_review_note text check(length(address_review_note)<=500),
 add constraint project_address_selection check(address_source is distinct from 'photon' or (address_ref is not null and latitude is not null and longitude is not null)),
 add constraint project_address_manual_note check(address_source is distinct from 'manual' or (address_review_note is not null and length(trim(address_review_note))>=10));
