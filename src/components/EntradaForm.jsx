import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { tiposSesion } from '../lib/especialidades.js'

function todayISO() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export default function EntradaForm({ entrada, onSave, onCancel, guardando }) {
  const { profesional } = useAuth()
  const [form, setForm] = useState({
    fecha: entrada?.fecha?.slice(0, 10) || todayISO(),
    tipo_sesion: entrada?.tipo_sesion || profesional?.especialidad || '',
    contenido: entrada?.contenido || '',
    conceptos_clave: entrada?.conceptos_clave?.join(', ') || '',
  })

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const conceptos = form.conceptos_clave
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    onSave({
      fecha: new Date(form.fecha + 'T12:00:00').toISOString(),
      tipo_sesion: form.tipo_sesion,
      contenido: form.contenido,
      conceptos_clave: conceptos.length > 0 ? conceptos : null,
    })
  }

  const inputClasses =
    'w-full rounded-lg border border-sage-300 bg-sage-50/50 px-3.5 py-2.5 text-sm text-sage-900 placeholder:text-sage-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-sage-200 p-6">
      <h3 className="text-sm font-medium text-sage-500 uppercase tracking-wider mb-5">
        {entrada ? 'Editar entrada' : 'Nueva entrada'}
      </h3>

      <div className="grid sm:grid-cols-2 gap-5 mb-5">
        <div>
          <label htmlFor="fecha" className="block text-sm font-medium text-sage-700 mb-1.5">
            Fecha
          </label>
          <input
            id="fecha"
            type="date"
            required
            value={form.fecha}
            onChange={update('fecha')}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="tipo_sesion" className="block text-sm font-medium text-sage-700 mb-1.5">
            Tipo de sesión
          </label>
          <select
            id="tipo_sesion"
            required
            value={form.tipo_sesion}
            onChange={update('tipo_sesion')}
            className={inputClasses}
          >
            <option value="" disabled>Elegir tipo...</option>
            {tiposSesion.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-5">
        <label htmlFor="contenido" className="block text-sm font-medium text-sage-700 mb-1.5">
          Contenido / Notas de lo trabajado
        </label>
        <textarea
          id="contenido"
          required
          rows={6}
          value={form.contenido}
          onChange={update('contenido')}
          placeholder="Describí lo trabajado en la sesión..."
          className={inputClasses + ' resize-y'}
        />
      </div>

      <div className="mb-6">
        <label htmlFor="conceptos" className="block text-sm font-medium text-sage-700 mb-1.5">
          Conceptos clave
        </label>
        <input
          id="conceptos"
          type="text"
          value={form.conceptos_clave}
          onChange={update('conceptos_clave')}
          placeholder="Separados por coma: atención, memoria de trabajo, regulación..."
          className={inputClasses}
        />
        <p className="text-xs text-sage-400 mt-1.5">Opcional. Separar con comas.</p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-sage-600 hover:bg-sage-100 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-colors cursor-pointer"
        >
          {guardando ? 'Guardando...' : entrada ? 'Guardar cambios' : 'Cargar entrada'}
        </button>
      </div>
    </form>
  )
}
