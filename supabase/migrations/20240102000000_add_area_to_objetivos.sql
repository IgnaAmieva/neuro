-- =============================================================
-- Neuroestima — Migración 3: Columna "area" en objetivos
-- =============================================================

alter table objetivos add column area text
  check (area in (
    'psicopedagogía','psicología','fonoaudiología',
    'terapia ocupacional','kinesiología'
  ));

create index idx_objetivos_area on objetivos(area);
