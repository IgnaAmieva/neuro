-- =============================================================
-- Neuroestima — Migración 5: Bucket de respaldos + Storage RLS
-- =============================================================

-- 1. Crear bucket privado "respaldos"
insert into storage.buckets (id, name, public)
values ('respaldos', 'respaldos', false)
on conflict (id) do nothing;

-- 2. Storage policies — solo admin puede leer/listar
create policy "respaldos: admin select"
  on storage.objects for select
  using (
    bucket_id = 'respaldos'
    and exists (
      select 1 from profesionales p
      where p.auth_user_id = auth.uid() and p.rol = 'admin'
    )
  );

-- La Edge Function sube con service_role (bypasea RLS),
-- así que no necesitamos INSERT policy para usuarios normales.

-- =============================================================
-- 3. Cron semanal — requiere extensión pg_cron habilitada
--    (En Supabase Dashboard → Database → Extensions → pg_cron)
-- =============================================================

-- Ejecutar el respaldo todos los domingos a las 03:00 UTC.
-- La función se invoca via pg_net (http request a la Edge Function).
-- NOTA: Reemplazar <PROJECT_REF> y <SERVICE_ROLE_KEY> con los valores reales.
--
-- Para cambiar la frecuencia, modificar la expresión cron:
--   '0 3 * * 0'  = domingos 03:00 UTC
--   '0 3 * * 1'  = lunes 03:00 UTC
--   '0 3 * * *'  = todos los días 03:00 UTC
--   '0 3 1 * *'  = primer día del mes 03:00 UTC
--
-- IMPORTANTE: Este bloque se debe ejecutar manualmente en el SQL Editor
-- de Supabase, reemplazando los placeholders, ya que las keys no deben
-- quedar hardcodeadas en archivos de migración versionados.
--
-- select cron.schedule(
--   'respaldo-excel-semanal',
--   '0 3 * * 0',
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/respaldo-excel',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
--
-- Para verificar que el cron quedó registrado:
--   select * from cron.job;
--
-- Para eliminarlo:
--   select cron.unschedule('respaldo-excel-semanal');
