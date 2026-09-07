import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

export default function Dashboard() {
  const { profesional } = useAuth()

  return (
    <div>
      <h2 className="font-display text-2xl font-medium text-sage-900 mb-2">
        Bienvenido{profesional?.nombre ? `, ${profesional.nombre.split(' ')[0]}` : ''}
      </h2>
      <p className="text-sage-500 text-sm mb-8">
        Panel de historias clínicas interdisciplinarias.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          to="/pacientes"
          className="bg-white rounded-2xl border border-sage-200 p-6 hover:border-teal-300 hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center mb-4 group-hover:bg-teal-200 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-teal-700">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="font-medium text-sage-900 group-hover:text-teal-700 transition-colors">Pacientes</h3>
          <p className="text-sm text-sage-500 mt-1">Ver y gestionar pacientes asignados</p>
        </Link>
      </div>
    </div>
  )
}
