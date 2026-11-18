create table public.external_event_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index external_event_assignments_event_id_idx on public.external_event_assignments(event_id);
alter table public.external_event_assignments enable row level security;
revoke all on public.external_event_assignments from public, anon, authenticated;
grant select, insert, update, delete on public.external_event_assignments to service_role;
