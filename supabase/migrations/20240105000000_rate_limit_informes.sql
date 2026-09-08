-- =============================================================
-- Neuroestima — Migración 6: Rate limiting para informes
-- =============================================================

create table rate_limit_informes (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references profesionales(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_rate_limit_informes_prof_date
  on rate_limit_informes (profesional_id, created_at);

-- No RLS needed — this table is only accessed by the Edge Function
-- via service_role key (bypasses RLS).
alter table rate_limit_informes enable row level security;
