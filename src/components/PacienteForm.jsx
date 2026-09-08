import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { especialidadLabel, especialidadColor } from '../lib/especialidades.js'

export default function PacienteForm({ paciente, equipoInicial, onSave, guardando }) {
  const { profesional } = useAuth()
  const [form, setForm] = useState({
    nombre: paciente?.nombre || '',
    fecha_nacimiento: paciente?.fecha_nacimiento || '',
    diagnostico: paciente?.diagnostico || '',
    notas_generales: paciente?.notas_generales || '',
    activo: paciente?.activo ?? true,
  })
  const [equipoIds, setEquipoIds] = useState(
    equipoInicial?.map((p) => p.id) || (profesional ? [profesional.id] : [])
  )
  const [todosProfs, setTodosProfs] = useState([])
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    supabase
      .from('profesionales')
      .select('id, nombre, especialidad')
      .order('nombre')
      .then(({ data, error }) => {
        if (error) {
          setLoadError('No se pudo cargar la lista de profesionales.')
        } else {
          setTodosProfs(data || [])
        }
      })
  }, [])

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function toggleProfesional(profId) {
    setEquipoIds((ids) =>
      ids.includes(profId) ? ids.filter((id) => id !== profId) : [...ids, profId]
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave(form, equipoIds)
  }

  const inputClasses =
    'w-full rounded-lg border border-sage-300 bg-sage-50/50 px-3.5 py-2.5 text-sm text-sage-900 placeholder:text-sage-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Datos básicos */}
      <div className="bg-white rounded-2xl border border-sage-200 p-6">
        <h3 className="text-sm font-medium text-sage-500 uppercase tracking-wider mb-5">
          Datos del paciente
        </h3>
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label htmlFor="nombre" className="block text-sm font-medium text-sage-700 mb-1.5">
              Nombre completo
            </label>
            <input
              id="nombre"
              type="text"
              required
              value={form.nombre}
              onChange={update('nombre')}
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="fecha_nacimiento" className="block text-sm font-medium text-sage-700 mb-1.5">
              Fecha de nacimiento
            </label>
            <input
              id="fecha_nacimiento"
              type="date"
              required
              value={form.fecha_nacimiento}
              onChange={update('fecha_nacimiento')}
              className={inputClasses}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                className="w-4 h-4 rounded border-sage-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-sage-700">Paciente activo</span>
            </label>
          </div>
        </div>
      </div>

      {/* Diagnóstico y notas */}
      <div className="bg-white rounded-2xl border border-sage-200 p-6">
        <h3 className="text-sm font-medium text-sage-500 uppercase tracking-wider mb-5">
          Información clínica
        </h3>
        <div className="space-y-5">
          <div>
            <label htmlFor="diagnostico" className="block text-sm font-medium text-sage-700 mb-1.5">
              Diagnóstico / Discapacidad
            </label>
            <textarea
              id="diagnostico"
              rows={3}
              value={form.diagnostico}
              onChange={update('diagnostico')}
              placeholder="Diagnóstico principal, discapacidad, CIE-10..."
              className={inputClasses + ' resize-y'}
            />
          </div>
          <div>
            <label htmlFor="notas_generales" className="block text-sm font-medium text-sage-700 mb-1.5">
              Notas generales
            </label>
            <textarea
              id="notas_generales"
              rows={3}
              value={form.notas_generales}
              onChange={update('notas_generales')}
              placeholder="Obra social, contacto familiar, observaciones generales..."
              className={inputClasses + ' resize-y'}
            />
          </div>
        </div>
      </div>

      {/* Equipo */}
      <div className="bg-white rounded-2xl border border-sage-200 p-6">
        <h3 className="text-sm font-medium text-sage-500 uppercase tracking-wider mb-2">
          Equipo de profesionales
        </h3>
        <p className="text-xs text-sage-400 mb-5">
          Seleccioná los profesionales que trabajarán con este paciente.
        </p>
        {loadError ? (
          <p className="text-clay-600 text-sm">{loadError}</p>
        ) : todosProfs.length === 0 ? (
          <p className="text-sage-400 text-sm italic">Cargando profesionales...</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {todosProfs.map((prof) => {
              const selected = equipoIds.includes(prof.id)
              return (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => toggleProfesional(prof.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selected
                      ? 'border-teal-400 bg-teal-50 ring-1 ring-teal-400/30'
                      : 'border-sage-200 bg-white hover:border-sage-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                    selected ? 'bg-teal-600' : 'border-2 border-sage-300'
                  }`}>
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-sage-800 truncate">{prof.nombre}</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-0.5 ${especialidadColor[prof.especialidad] || 'bg-sage-100 text-sage-600'}`}>
                      {especialidadLabel[prof.especialidad] || prof.especialidad}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={guardando || equipoIds.length === 0}
          className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-colors cursor-pointer"
        >
          {guardando ? 'Guardando...' : paciente ? 'Guardar cambios' : 'Crear paciente'}
        </button>
      </div>
    </form>
  )
}
