-- =============================================================
-- Neuroestima — Migración 1: Tablas e índices
-- =============================================================

-- 1. Profesionales
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

-- 2. Pacientes
create table pacientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  fecha_nacimiento date not null,
  diagnostico text,
  notas_generales text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Relación muchos a muchos: paciente <> profesional
create table paciente_profesional (
  paciente_id uuid not null references pacientes(id) on delete cascade,
  profesional_id uuid not null references profesionales(id) on delete cascade,
  asignado_en timestamptz not null default now(),
  primary key (paciente_id, profesional_id)
);

-- 4. Entradas de historia clínica
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

-- 5. Objetivos del equipo
create table objetivos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  descripcion text not null,
  plazo text not null
    check (plazo in ('mensual','3 meses','6 meses','anual')),
  fecha_inicio date not null default current_date,
  estado text not null default 'en progreso'
    check (estado in ('en progreso','logrado','pausado')),
  creado_por uuid not null references profesionales(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- 6. Historial de cambios de estado de objetivos
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

-- Índices
create index idx_entradas_paciente on entradas_historia_clinica(paciente_id);
create index idx_entradas_profesional on entradas_historia_clinica(profesional_id);
create index idx_objetivos_paciente on objetivos(paciente_id);
create index idx_paciente_profesional_prof on paciente_profesional(profesional_id);
create index idx_objetivo_historial_objetivo on objetivo_historial(objetivo_id);
