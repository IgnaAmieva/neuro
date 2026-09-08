# Neuroestima

Sistema de gestión de historias clínicas interdisciplinarias para clínica de neurorehabilitación (psicopedagogía, psicología, fonoaudiología, terapia ocupacional, kinesiología).

## Stack

- **Frontend**: Vite + React + React Router + Tailwind CSS v4
- **Backend**: Supabase (Auth + PostgreSQL + Edge Functions)
- **IA**: Anthropic Claude (generación de informes clínicos)
- **PDF**: jsPDF (generación client-side)
- **Deploy**: Vercel

## Setup local

```bash
# 1. Clonar e instalar
git clone <tu-repo-url>
cd neuroestima
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase
```

### Variables de entorno (frontend)

| Variable | Dónde encontrarla |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Dashboard > Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard > Settings > API > `anon` public key |

### Variables de entorno (Supabase Edge Functions)

| Variable | Descripción |
|---|---|
| `ANTHROPIC_API_KEY` | API key de Anthropic para generación de informes |

Configurar en Supabase Dashboard > Edge Functions > Secrets, o con CLI:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### Variables de entorno (Vercel)

Las mismas del frontend (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) se configuran en Vercel Dashboard > Settings > Environment Variables.

## Base de datos

Las migraciones están en `supabase/migrations/` y se ejecutan en orden:

1. `20240101000000_create_tables.sql` — Tablas e índices
2. `20240101000001_row_level_security.sql` — RLS y políticas de seguridad
3. `20240102000000_add_area_to_objetivos.sql` — Columna area en objetivos
4. `20240103000000_rpc_crear_paciente_con_equipo.sql` — RPC para creación atómica de paciente + equipo
5. `20240104000000_storage_respaldos.sql` — Bucket de respaldos + Storage RLS + cron
6. `20240105000000_rate_limit_informes.sql` — Rate limiting para generación de informes
7. `20240106000000_idx_entradas_paciente_fecha.sql` — Índice compuesto para filtros por período

### Aplicar migraciones

**Opción A — Supabase CLI (recomendado):**

```bash
npx supabase db push
```

**Opción B — Manual:**

Copiar el contenido de cada archivo `.sql` en orden al SQL Editor del dashboard de Supabase.

## Edge Functions

### generar-informe

Proxy seguro para la API de Anthropic. Recibe entradas de historia clínica + objetivos y genera un informe redactado por IA.

```bash
# Deploy
npx supabase functions deploy generar-informe
```

## Desarrollo

```bash
npm run dev       # Servidor de desarrollo (http://localhost:5173)
npm run build     # Build de producción
npm run preview   # Preview del build
```

## Deploy a Vercel

### Primera vez

1. Crear un repositorio en GitHub y pushearlo
2. Ir a [vercel.com/new](https://vercel.com/new) e importar el repositorio
3. Vercel detecta Vite automáticamente — no hace falta configurar nada de build
4. Agregar las variables de entorno en **Settings > Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy

### Flujo de trabajo

| Rama | Entorno |
|---|---|
| `main` | **Producción** — deploy automático en cada push |
| `dev` | **Preview** — cada push genera un preview deployment con URL temporal |

Para trabajar en un cambio:

```bash
git checkout dev
# hacer cambios
git add . && git commit -m "descripción del cambio"
git push origin dev
# Vercel genera un preview → revisar → merge a main cuando esté listo
```

## Monitoreo y logs

### Frontend — Vercel Dashboard

- **Analytics**: [vercel.com/dashboard](https://vercel.com/dashboard) > tu proyecto > Analytics. Muestra visitas, páginas más vistas, dispositivos, y Core Web Vitals. Se activa automáticamente con `@vercel/analytics` (ya integrado en `main.jsx`).
- **Deployments**: pestaña Deployments — historial de deploys, logs de build, preview URLs.
- **Logs en tiempo real**: pestaña Logs (Observability) — requests al frontend, errores del lado del cliente.

### Base de datos — Supabase Dashboard

- **Tabla de datos**: [supabase.com/dashboard](https://supabase.com/dashboard) > tu proyecto > Table Editor — ver y editar datos directamente.
- **SQL Editor**: para ejecutar queries, migraciones manuales, verificar cron jobs (`select * from cron.job`).
- **Auth**: pestaña Authentication — usuarios registrados, sesiones activas.
- **Storage**: pestaña Storage > bucket `respaldos` — archivos de respaldo Excel.

### Edge Functions — Supabase Dashboard

- **Logs**: pestaña Edge Functions > seleccionar función > Logs. Acá aparecen todos los `console.log` y `console.error` de las funciones `generar-informe` y `respaldo-excel`.
- **Métricas**: misma sección — invocaciones, tiempos de ejecución, errores.
- **Secrets**: pestaña Edge Functions > Secrets — donde se configuran `ANTHROPIC_API_KEY` y otras variables sensibles.

### Cron de respaldos

El respaldo automático semanal se configura con `pg_cron`. Para verificar:

```sql
-- Ver cron jobs registrados
select * from cron.job;

-- Ver historial de ejecuciones
select * from cron.job_run_details order by start_time desc limit 10;

-- Cambiar frecuencia (ejemplo: diario a las 03:00 UTC)
select cron.unschedule('respaldo-excel-semanal');
select cron.schedule('respaldo-excel-semanal', '0 3 * * *', $$ ... $$);
```

## Escalabilidad: multi-tenant para múltiples clínicas

La arquitectura actual es single-tenant (una sola clínica). Para vender el sistema a otras clínicas sin rehacer la arquitectura:

### Paso 1 — Agregar `clinica_id` a las tablas

```sql
-- Crear tabla de clínicas
create table clinicas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

-- Agregar columna a cada tabla principal
alter table profesionales add column clinica_id uuid references clinicas(id);
alter table pacientes add column clinica_id uuid references clinicas(id);
-- entradas, objetivos, etc. heredan la clínica vía paciente/profesional,
-- no necesitan su propia columna.

-- Índices
create index idx_profesionales_clinica on profesionales(clinica_id);
create index idx_pacientes_clinica on pacientes(clinica_id);
```

### Paso 2 — Ajustar RLS

Reemplazar las policies para que filtren siempre por clínica. Ejemplo para pacientes:

```sql
-- Función auxiliar actualizada
create or replace function get_clinica_id()
returns uuid language sql stable security definer as $$
  select clinica_id from profesionales where auth_user_id = auth.uid();
$$;

-- Policy: un profesional solo ve pacientes de su clínica
create policy "pacientes: ver de mi clínica"
  on pacientes for select
  using (clinica_id = get_clinica_id());
```

Aplicar el mismo patrón a `profesionales`, `paciente_profesional`, `entradas_historia_clinica`, `objetivos`, y `objetivo_historial`.

### Paso 3 — Frontend

- Agregar selector de clínica en el registro (o asignarla por invitación).
- El `AuthProvider` ya carga el profesional completo — simplemente incluir `clinica_id` en el contexto.
- No hace falta cambiar componentes: las queries a Supabase ya están filtradas por RLS.

### Paso 4 — Edge Functions

- `generar-informe`: no necesita cambios (ya opera sobre entradas que el frontend le pasa, filtradas por RLS).
- `respaldo-excel`: agregar `clinica_id` al filtro de cada tabla, o generar un respaldo por clínica.

### Lo que NO cambia

- La estructura de tablas existente (solo se agrega una columna).
- El frontend (los componentes no manejan `clinica_id` directamente, RLS lo hace transparente).
- Las Edge Functions de informes (reciben datos ya filtrados).

---

## Rendimiento: índice para filtros por período

Las consultas de historia clínica filtran por `paciente_id` + rango de `fecha`. El índice compuesto optimiza esto:

```sql
-- Migración 7 (20240106000000_idx_entradas_paciente_fecha.sql)
create index concurrently idx_entradas_paciente_fecha
  on entradas_historia_clinica (paciente_id, fecha desc);
```

Ejecutar en el SQL Editor de Supabase. El `concurrently` evita bloquear la tabla durante la creación.

A medida que la base crece, monitorear con:

```sql
-- Ver si el índice se está usando
explain analyze
select * from entradas_historia_clinica
where paciente_id = '[uuid]' and fecha >= '2026-01-01'
order by fecha desc;
-- Debería mostrar "Index Scan using idx_entradas_paciente_fecha"
```

---

## Cumplimiento legal y protección de datos

> **Esta sección es un template.** Completar con el criterio legal que corresponda según la normativa argentina vigente (Ley 26.529 de Derechos del Paciente, Ley 25.326 de Protección de Datos Personales, disposiciones del Ministerio de Salud).

### Consentimiento informado

- [ ] **Definir el texto del consentimiento** que el paciente (o su representante legal) debe firmar antes de que se registren datos en el sistema.
- [ ] **Definir si el consentimiento se registra digitalmente** (checkbox al crear paciente, con fecha y responsable) o en papel (escaneado y subido al sistema).
- [ ] **Consentimiento para uso de IA**: el sistema genera informes usando inteligencia artificial (Anthropic Claude). Definir si esto requiere un consentimiento adicional específico y qué información se debe dar al paciente sobre cómo se procesan sus datos.
- [ ] **Revocación**: definir el proceso para revocar el consentimiento y qué sucede con los datos ya registrados.

### Exportación de datos de un paciente

Para cumplir con el derecho de acceso del paciente a su historia clínica:

- [ ] **Definir el formato de exportación**: el sistema ya genera PDFs de informes. Evaluar si se necesita además un export completo (todas las entradas + objetivos) en PDF o Excel.
- [ ] **Definir quién puede solicitar la exportación**: el paciente, su representante legal, otro profesional con autorización.
- [ ] **Definir el plazo de entrega**: la normativa argentina establece plazos para entregar copia de la historia clínica.
- [ ] **Implementación sugerida**: agregar un botón "Exportar historia completa" en la pestaña del paciente, visible para admin o el equipo asignado.

### Retención y eliminación de datos

- [ ] **Tiempo de retención mínimo**: definir según normativa (la Ley 26.529 establece que las historias clínicas deben conservarse por un mínimo de **10 años** desde la última actuación registrada).
- [ ] **Política de eliminación**: definir qué sucede después del período de retención — archivo, anonimización, o eliminación.
- [ ] **Eliminación a pedido del paciente**: definir si es posible y bajo qué condiciones, considerando la obligación legal de retención.
- [ ] **Respaldos**: los respaldos en Excel en el bucket `respaldos` también contienen datos de pacientes. Aplicar la misma política de retención.
- [ ] **Soft delete vs hard delete**: actualmente los pacientes tienen campo `activo` (soft delete). Evaluar si se necesita un mecanismo de hard delete con auditoría para cumplir con solicitudes de eliminación.

### Seguridad de datos clínicos

Medidas ya implementadas:

- **RLS en todas las tablas**: cada profesional solo accede a pacientes de su equipo.
- **Anonimización en IA**: el nombre del paciente se reemplaza por iniciales antes de enviarse a la API de Anthropic.
- **Rate limiting**: máximo 5 informes por minuto por profesional.
- **Respaldos privados**: bucket con acceso restringido a admin.
- **Sin keys sensibles en el frontend**: `ANTHROPIC_API_KEY` y `SERVICE_ROLE_KEY` solo existen en las Edge Functions.

Medidas pendientes de evaluación:

- [ ] **Cifrado en reposo**: Supabase cifra los datos en reposo por defecto. Verificar que cumple con los requisitos.
- [ ] **Auditoría de acceso**: evaluar si se necesita un log de quién accedió a qué historia clínica y cuándo.
- [ ] **Cifrado de campos sensibles**: evaluar si campos como `contenido` en entradas necesitan cifrado adicional a nivel de aplicación.

---

## Estructura del proyecto

```
neuroestima/
├── src/
│   ├── components/       # Componentes reutilizables
│   ├── hooks/            # Custom hooks (useAuth)
│   ├── lib/              # Cliente Supabase, constantes
│   └── pages/            # Páginas/rutas
├── supabase/
│   ├── migrations/       # Migraciones SQL versionadas
│   └── functions/        # Edge Functions (generar-informe, respaldo-excel)
├── .env.example          # Template de variables de entorno
└── vite.config.js
```
