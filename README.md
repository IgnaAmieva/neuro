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
