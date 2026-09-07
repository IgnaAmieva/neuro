-- =============================================================
-- Neuroestima — Migración 2: Row Level Security
-- =============================================================

-- Función auxiliar: obtener el profesional_id del usuario autenticado
create or replace function get_profesional_id()
returns uuid
language sql
stable
security definer
as $$
  select id from profesionales where auth_user_id = auth.uid();
$$;

-- -----------------------------------------------
-- RLS: profesionales
-- -----------------------------------------------
alter table profesionales enable row level security;

create policy "profesionales: ver todos (autenticado)"
  on profesionales for select
  using (auth.uid() is not null);

create policy "profesionales: insertar propio"
  on profesionales for insert
  with check (auth_user_id = auth.uid());

-- -----------------------------------------------
-- RLS: pacientes
-- -----------------------------------------------
alter table pacientes enable row level security;

create policy "pacientes: ver asignados"
  on pacientes for select
  using (
    id in (
      select paciente_id from paciente_profesional
      where profesional_id = get_profesional_id()
    )
  );

create policy "pacientes: insertar (autenticado)"
  on pacientes for insert
  with check (auth.uid() is not null);

create policy "pacientes: actualizar asignados"
  on pacientes for update
  using (
    id in (
      select paciente_id from paciente_profesional
      where profesional_id = get_profesional_id()
    )
  );

create policy "pacientes: admin ve todos"
  on pacientes for select
  using (
    exists (
      select 1 from profesionales p
      where p.auth_user_id = auth.uid() and p.rol = 'admin'
    )
  );

-- -----------------------------------------------
-- RLS: paciente_profesional
-- -----------------------------------------------
alter table paciente_profesional enable row level security;

create policy "paciente_profesional: ver de pacientes asignados"
  on paciente_profesional for select
  using (
    paciente_id in (
      select paciente_id from paciente_profesional pp
      where pp.profesional_id = get_profesional_id()
    )
  );

create policy "paciente_profesional: insertar (autenticado)"
  on paciente_profesional for insert
  with check (auth.uid() is not null);

create policy "paciente_profesional: eliminar de pacientes asignados"
  on paciente_profesional for delete
  using (
    paciente_id in (
      select paciente_id from paciente_profesional pp
      where pp.profesional_id = get_profesional_id()
    )
  );

create policy "paciente_profesional: admin full"
  on paciente_profesional for all
  using (
    exists (
      select 1 from profesionales p
      where p.auth_user_id = auth.uid() and p.rol = 'admin'
    )
  );

-- -----------------------------------------------
-- RLS: entradas_historia_clinica
-- -----------------------------------------------
alter table entradas_historia_clinica enable row level security;

create policy "entradas: ver de pacientes asignados"
  on entradas_historia_clinica for select
  using (
    paciente_id in (
      select paciente_id from paciente_profesional
      where profesional_id = get_profesional_id()
    )
  );

create policy "entradas: insertar en pacientes asignados"
  on entradas_historia_clinica for insert
  with check (
    profesional_id = get_profesional_id()
    and paciente_id in (
      select paciente_id from paciente_profesional
      where profesional_id = get_profesional_id()
    )
  );

create policy "entradas: actualizar propias"
  on entradas_historia_clinica for update
  using (profesional_id = get_profesional_id());

create policy "entradas: eliminar propias"
  on entradas_historia_clinica for delete
  using (profesional_id = get_profesional_id());

-- -----------------------------------------------
-- RLS: objetivos
-- -----------------------------------------------
alter table objetivos enable row level security;

create policy "objetivos: ver de pacientes asignados"
  on objetivos for select
  using (
    paciente_id in (
      select paciente_id from paciente_profesional
      where profesional_id = get_profesional_id()
    )
  );

create policy "objetivos: insertar en pacientes asignados"
  on objetivos for insert
  with check (
    creado_por = get_profesional_id()
    and paciente_id in (
      select paciente_id from paciente_profesional
      where profesional_id = get_profesional_id()
    )
  );

create policy "objetivos: actualizar de pacientes asignados"
  on objetivos for update
  using (
    paciente_id in (
      select paciente_id from paciente_profesional
      where profesional_id = get_profesional_id()
    )
  );

-- -----------------------------------------------
-- RLS: objetivo_historial
-- -----------------------------------------------
alter table objetivo_historial enable row level security;

create policy "objetivo_historial: ver de pacientes asignados"
  on objetivo_historial for select
  using (
    objetivo_id in (
      select o.id from objetivos o
      join paciente_profesional pp on pp.paciente_id = o.paciente_id
      where pp.profesional_id = get_profesional_id()
    )
  );

create policy "objetivo_historial: insertar de pacientes asignados"
  on objetivo_historial for insert
  with check (
    cambiado_por = get_profesional_id()
    and objetivo_id in (
      select o.id from objetivos o
      join paciente_profesional pp on pp.paciente_id = o.paciente_id
      where pp.profesional_id = get_profesional_id()
    )
  );
