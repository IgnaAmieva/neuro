# Checklist de test manual — pre-deploy a producción

Correr antes de cada merge a `main`. Usar un navegador en modo incógnito para
evitar caché/sesiones anteriores.

## 1. Autenticación

- [ ] Login con credenciales válidas → redirige al Dashboard
- [ ] Login con credenciales incorrectas → muestra error claro (no técnico)
- [ ] Refrescar la página estando logueado → mantiene la sesión
- [ ] Cerrar sesión → redirige al login
- [ ] Acceder a `/pacientes` sin sesión → redirige al login
- [ ] Registro de nuevo profesional → queda logueado y aparece en el sistema

## 2. Pacientes

- [ ] Listado muestra pacientes asignados al profesional logueado
- [ ] Filtro activos/inactivos/todos funciona
- [ ] Búsqueda por nombre y diagnóstico funciona
- [ ] Crear nuevo paciente con equipo → aparece en el listado
- [ ] Editar paciente → cambios se guardan correctamente
- [ ] Agregar/quitar profesionales del equipo → se refleja en la pestaña Equipo

## 3. Historia clínica

- [ ] Crear nueva entrada (fecha, tipo sesión, contenido, conceptos clave)
- [ ] La entrada aparece en el listado cronológico
- [ ] Editar entrada propia → cambios se guardan
- [ ] Eliminar entrada propia → confirmación + se borra
- [ ] NO se pueden editar/eliminar entradas de otros profesionales
- [ ] Filtro por período funciona (probar 1 semana, 3 meses, Todo)
- [ ] Filtro por área funciona (desactivar/activar chips)
- [ ] Combinar filtro período + área → muestra el subconjunto correcto
- [ ] Contador "X de Y" se actualiza con los filtros

## 4. Objetivos

- [ ] Ver grilla de objetivos por plazo × área
- [ ] Crear objetivo en el área propia → aparece en la celda correcta
- [ ] Editar objetivo propio → se guarda
- [ ] Cambiar estado (en progreso / logrado / pausado) en objetivo de área propia
- [ ] NO se puede cambiar estado de objetivos de otras áreas
- [ ] Ver historial de cambios de un objetivo (expandir)
- [ ] Filtro activos/logrados/todos funciona

## 5. Generación de informe con IA

- [ ] Abrir modal "Generar informe"
- [ ] Seleccionar período y áreas en la configuración
- [ ] El contador de entradas se actualiza al cambiar filtros
- [ ] Escribir un destinatario opcional
- [ ] Click "Generar con IA" → spinner con resumen de filtros
- [ ] Informe generado aparece en el editor de texto
- [ ] El informe usa iniciales del paciente (no nombre completo)
- [ ] Editar el texto del informe manualmente
- [ ] "Regenerar" → genera un nuevo informe
- [ ] "Volver a configurar" → vuelve al paso de configuración
- [ ] Descargar PDF:
  - [ ] Header con logo Neuroestima y fecha
  - [ ] Datos del paciente (nombre completo en el PDF sí)
  - [ ] Filtro aplicado en los metadatos
  - [ ] Cuerpo del informe con formato (títulos, bullets)
  - [ ] Anexo con entradas de respaldo
  - [ ] Paginación correcta

## 6. Respaldos (solo admin)

- [ ] El tab "Respaldos" solo aparece para usuarios con rol admin
- [ ] Un usuario no-admin que navega a `/respaldos` es redirigido
- [ ] "Generar respaldo ahora" → genera y sube el Excel
- [ ] El respaldo aparece en el listado con nombre, fecha y tamaño
- [ ] Descargar respaldo → Excel con 6 hojas (una por tabla)
- [ ] Verificar que el Excel tiene datos (abrir y revisar al menos 1 hoja)

## 7. Manejo de errores

- [ ] Desconectar internet → las operaciones muestran error amigable (no técnico)
- [ ] Reconectar → las operaciones vuelven a funcionar
- [ ] Generar más de 5 informes en 1 minuto → muestra mensaje de rate limit

## 8. Navegación SPA

- [ ] Acceder directo a `/pacientes` (no desde el menú) → carga correctamente
- [ ] Refrescar estando en `/pacientes/[id]` → carga correctamente
- [ ] Usar botón atrás del navegador → navega correctamente

## 9. Tests automáticos

```bash
npm test
```

- [ ] Todos los tests de filtrado pasan
- [ ] Todos los tests de la Edge Function pasan
