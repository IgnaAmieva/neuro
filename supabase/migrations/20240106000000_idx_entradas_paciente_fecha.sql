-- =============================================================
-- Neuroestima — Migración 7: Índice compuesto para filtros por período
-- =============================================================
-- Optimiza los queries que filtran entradas por paciente + rango de fechas,
-- que es exactamente lo que hacen los filtros de período en la historia clínica.

create index concurrently if not exists idx_entradas_paciente_fecha
  on entradas_historia_clinica (paciente_id, fecha desc);
