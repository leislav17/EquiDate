create table public.manual_live_entries (
 id uuid primary key, class_id uuid not null references public.competition_classes on delete cascade,
 rider text not null check(length(trim(rider)) between 1 and 160),
 horse text not null check(length(trim(horse)) between 1 and 160),
 category text not null default '', position integer check(position>0),
 obstacle_faults integer check(obstacle_faults between 0 and 999),
 time_seconds numeric(9,2) check(time_seconds>=0),
 phase2_faults integer check(phase2_faults between 0 and 999),
 phase2_seconds numeric(9,2) check(phase2_seconds>=0),
 created_at timestamptz not null default now(),
 check ((obstacle_faults is null)=(time_seconds is null)),
 check ((phase2_faults is null)=(phase2_seconds is null)),
 check (phase2_seconds is null or time_seconds is not null)
);
create index manual_live_class on public.manual_live_entries(class_id);
alter table public.manual_live_entries enable row level security;
revoke all on public.manual_live_entries from public,anon,authenticated;
grant select on public.manual_live_entries to anon,authenticated;
grant select,insert,update on public.manual_live_entries to service_role;
create policy manual_public on public.manual_live_entries for select to anon,authenticated using
(trim(category)<>'' and exists(select 1 from public.competition_classes c join public.events e on e.id=c.event_id where c.id=class_id and e.status='published'));
