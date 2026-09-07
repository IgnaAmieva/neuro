-- =============================================================
-- Neuroestima — Esquema de base de datos
-- Ejecutar en Supabase SQL Editor
-- =============================================================

-- -----------------------------------------------
-- 1. Profesionales
-- -----------------------------------------------
create table profesionales (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  nombre text not null,
  email text unique not null,
  especialidad text not null
    check (especialidad in (
      'psicopedagogía','psicología','fonoaudiología',
      'terapia ocupacional','kinesiología'
    )),
  rol text not null default 'profesional'
    check (rol in ('admin','profesional')),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------
-- 2. Pacientes
-- -----------------------------------------------
create table pacientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  fecha_nacimiento date not null,
  diagnostico text,
  notas_generales text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------
-- 3. Relación muchos a muchos: paciente ↔ profesional
-- -----------------------------------------------
create table paciente_profesional (
  paciente_id uuid not null references pacientes(id) on delete cascade,
  profesional_id uuid not null references profesionales(id) on delete cascade,
  asignado_en timestamptz not null default now(),
  primary key (paciente_id, profesional_id)
);

-- -----------------------------------------------
-- 4. Entradas de historia clínica
-- -----------------------------------------------
create table entradas_historia_clinica (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  profesional_id uuid not null references profesionales(id) on delete restrict,
  fecha timestamptz not null default now(),
  tipo_sesion text not null
    check (tipo_sesion in (
      'psicopedagogía','psicología','fonoaudiología',
      'terapia ocupacional','kinesiología','interdisciplinaria'
    )),
  contenido text not null,
  conceptos_clave text[],
  created_at timestamptz not null default now()
);

-- -----------------------------------------------
-- 5. Objetivos del equipo
-- -----------------------------------------------
create table objetivos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  descripcion text not null,
  plazo text not null
    check (plazo in ('mensual','3 meses','6 meses','anual')),
  fecha_inicio date not null default current_date,
  estado text not null default 'en progreso'
    check (estado in ('en progreso','logrado','pausado')),
  area text
    check (area in (
      'psicopedagogía','psicología','fonoaudiología',
      'terapia ocupacional','kinesiología'
    )),
  creado_por uuid not null references profesionales(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------
-- 6. Historial de cambios de estado de objetivos
-- -----------------------------------------------
create table objetivo_historial (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid not null references objetivos(id) on delete cascade,
  estado_anterior text not null
    check (estado_anterior in ('en progreso','logrado','pausado')),
  estado_nuevo text not null
    check (estado_nuevo in ('en progreso','logrado','pausado')),
  cambiado_por uuid not null references profesionales(id) on delete restrict,
  fecha timestamptz not null default now()
);

-- -----------------------------------------------
-- Índices
-- -----------------------------------------------
create index idx_entradas_paciente on entradas_historia_clinica(paciente_id);
create index idx_entradas_profesional on entradas_historia_clinica(profesional_id);
create index idx_objetivos_paciente on objetivos(paciente_id);
create index idx_paciente_profesional_prof on paciente_profesional(profesional_id);
create index idx_objetivos_area on objetivos(area);
create index idx_objetivo_historial_objetivo on objetivo_historial(objetivo_id);

-- =============================================================
-- Row Level Security
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

-- Cualquier profesional autenticado puede ver a todos los demás
-- (necesario para el selector de equipo al asignar pacientes)
create policy "profesionales: ver todos (autenticado)"
  on profesionales for select
  using (auth.uid() is not null);

-- Un usuario autenticado puede insertar su propio registro (registro)
create policy "profesionales: insertar propio"
  on profesionales for insert
  with check (auth_user_id = auth.uid());

-- -----------------------------------------------
-- RLS: pacientes
-- -----------------------------------------------
alter table pacientes enable row level security;

-- Un profesional ve pacientes que tiene asignados
create policy "pacientes: ver asignados"
  on pacientes for select
  using (
    id in (
      select paciente_id from paciente_profesional
      where profesional_id = get_profesional_id()
    )
  );

-- Cualquier profesional autenticado puede crear un paciente
create policy "pacientes: insertar (autenticado)"
  on pacientes for insert
  with check (auth.uid() is not null);

-- Un profesional asignado puede editar datos del paciente
create policy "pacientes: actualizar asignados"
  on pacientes for update
  using (
    id in (
      select paciente_id from paciente_profesional
      where profesional_id = get_profesional_id()
    )
  );

-- Admin puede ver todos los pacientes
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

-- Un profesional ve asignaciones de sus pacientes (para ver el equipo completo)
create policy "paciente_profesional: ver de pacientes asignados"
  on paciente_profesional for select
  using (
    paciente_id in (
      select paciente_id from paciente_profesional pp
      where pp.profesional_id = get_profesional_id()
    )
  );

-- Cualquier profesional autenticado puede crear asignaciones
-- (necesario al crear un paciente nuevo y asignar equipo)
create policy "paciente_profesional: insertar (autenticado)"
  on paciente_profesional for insert
  with check (auth.uid() is not null);

-- Un profesional asignado al paciente puede quitar asignaciones
create policy "paciente_profesional: eliminar de pacientes asignados"
  on paciente_profesional for delete
  using (
    paciente_id in (
      select paciente_id from paciente_profesional pp
      where pp.profesional_id = get_profesional_id()
    )
  );

-- Admin puede gestionar todas las asignaciones
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

-- Ver entradas: solo si el profesional está asignado al paciente
create policy "entradas: ver de pacientes asignados"
  on entradas_historia_clinica for select
  using (
    paciente_id in (
      select paciente_id from paciente_profesional
      where profesional_id = get_profesional_id()
    )
  );

-- Insertar entradas: solo para pacientes asignados y con su propio profesional_id
create policy "entradas: insertar en pacientes asignados"
  on entradas_historia_clinica for insert
  with check (
    profesional_id = get_profesional_id()
    and paciente_id in (
      select paciente_id from paciente_profesional
      where profesional_id = get_profesional_id()
    )
  );

-- Actualizar entradas: solo las propias
create policy "entradas: actualizar propias"
  on entradas_historia_clinica for update
  using (profesional_id = get_profesional_id());

-- Eliminar entradas: solo las propias
create policy "entradas: eliminar propias"
  on entradas_historia_clinica for delete
  using (profesional_id = get_profesional_id());

-- -----------------------------------------------
-- RLS: objetivos
-- -----------------------------------------------
alter table objetivos enable row level security;

-- Ver objetivos: solo si el profesional está asignado al paciente
create policy "objetivos: ver de pacientes asignados"
  on objetivos for select
  using (
    paciente_id in (
      select paciente_id from paciente_profesional
      where profesional_id = get_profesional_id()
    )
  );

-- Insertar objetivos: solo para pacientes asignados
create policy "objetivos: insertar en pacientes asignados"
  on objetivos for insert
  with check (
    creado_por = get_profesional_id()
    and paciente_id in (
      select paciente_id from paciente_profesional
      where profesional_id = get_profesional_id()
    )
  );

-- Actualizar estado de objetivos: solo si está asignado al paciente
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

-- Ver historial: si el profesional está asignado al paciente del objetivo
create policy "objetivo_historial: ver de pacientes asignados"
  on objetivo_historial for select
  using (
    objetivo_id in (
      select o.id from objetivos o
      join paciente_profesional pp on pp.paciente_id = o.paciente_id
      where pp.profesional_id = get_profesional_id()
    )
  );

-- Insertar historial: cualquier profesional asignado al paciente del objetivo
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
