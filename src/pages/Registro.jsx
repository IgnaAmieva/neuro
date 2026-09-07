import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { especialidades } from '../lib/especialidades.js'

export default function Registro() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    especialidad: '',
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.especialidad) {
      setError('Seleccioná una especialidad.')
      return
    }

    setLoading(true)

    // 1. Crear usuario en auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // 2. Insertar fila en profesionales
    const { error: profError } = await supabase.from('profesionales').insert({
      auth_user_id: authData.user.id,
      nombre: form.nombre,
      email: form.email,
      especialidad: form.especialidad,
    })

    if (profError) {
      setError('Error al crear el profesional: ' + profError.message)
      setLoading(false)
      return
    }

    navigate('/', { replace: true })
  }

  const inputClasses =
    'w-full rounded-lg border border-sage-300 bg-sage-50/50 px-3.5 py-2.5 text-sm text-sage-900 placeholder:text-sage-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors'

  return (
    <div className="min-h-screen bg-sage-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center mx-auto mb-5 shadow-sm">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a7 7 0 0 1 7 7c0 3-1.5 5.5-4 7.5V19a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2.5C6.5 14.5 5 12 5 9a7 7 0 0 1 7-7z" />
              <path d="M9 22h6" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-medium text-sage-900 tracking-tight">
            Neuroestima
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-sage-200 p-8">
          <h2 className="text-lg font-medium text-sage-800 mb-6">Registrar profesional</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-clay-500/10 border border-clay-500/20 text-clay-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-sage-700 mb-1.5">
                Nombre completo
              </label>
              <input
                id="nombre"
                type="text"
                required
                value={form.nombre}
                onChange={update('nombre')}
                placeholder="Lic. María López"
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-sage-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={update('email')}
                placeholder="profesional@clinica.com"
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-sage-700 mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={update('password')}
                placeholder="Mínimo 6 caracteres"
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="especialidad" className="block text-sm font-medium text-sage-700 mb-1.5">
                Especialidad
              </label>
              <select
                id="especialidad"
                required
                value={form.especialidad}
                onChange={update('especialidad')}
                className={`${inputClasses} ${!form.especialidad ? 'text-sage-400' : ''}`}
              >
                <option value="" disabled>Elegir especialidad</option>
                {especialidades.map((esp) => (
                  <option key={esp.value} value={esp.value}>{esp.label}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors cursor-pointer"
            >
              {loading ? 'Registrando...' : 'Registrar profesional'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-sage-400 mt-6">
          <Link to="/login" className="text-teal-600 hover:text-teal-700 transition-colors">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
