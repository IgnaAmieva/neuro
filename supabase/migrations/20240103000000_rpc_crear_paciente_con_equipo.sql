-- =============================================================
-- Neuroestima — Migración 4: RPC crear_paciente_con_equipo
-- Resuelve el conflicto de RLS al crear un paciente: el SELECT
-- policy exige que el profesional ya esté asignado, pero la
-- asignación no existe aún en el momento del insert+select.
-- =============================================================

create or replace function crear_paciente_con_equipo(
  p_nombre text,
  p_fecha_nacimiento date,
  p_diagnostico text default null,
  p_notas_generales text default null,
  p_activo boolean default true,
  p_equipo_ids uuid[] default '{}'
)
returns pacientes
language plpgsql
security definer
as $$
declare
  v_profesional_id uuid;
  v_paciente pacientes;
  v_prof_id uuid;
begin
  -- Validar que quien llama está autenticado
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  -- Obtener el profesional_id del usuario autenticado
  select id into v_profesional_id
    from profesionales
    where auth_user_id = auth.uid();

  if v_profesional_id is null then
    raise exception 'No se encontró un profesional para este usuario';
  end if;

  -- Insertar el paciente
  insert into pacientes (nombre, fecha_nacimiento, diagnostico, notas_generales, activo)
    values (p_nombre, p_fecha_nacimiento, p_diagnostico, p_notas_generales, p_activo)
    returning * into v_paciente;

  -- Asegurar que el profesional que crea esté en la lista
  if not (v_profesional_id = any(p_equipo_ids)) then
    p_equipo_ids := array_append(p_equipo_ids, v_profesional_id);
  end if;

  -- Insertar asignaciones
  foreach v_prof_id in array p_equipo_ids loop
    insert into paciente_profesional (paciente_id, profesional_id)
      values (v_paciente.id, v_prof_id);
  end loop;

  return v_paciente;
end;
$$;
