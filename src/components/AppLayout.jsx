import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { especialidadLabel } from '../lib/especialidades.js'

const navItems = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/pacientes', label: 'Pacientes' },
]

const adminNavItems = [
  { to: '/respaldos', label: 'Respaldos' },
]

export default function AppLayout() {
  const { profesional, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-sage-50 flex flex-col">
      <header className="bg-white/80 backdrop-blur-sm border-b border-sage-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a7 7 0 0 1 7 7c0 3-1.5 5.5-4 7.5V19a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2.5C6.5 14.5 5 12 5 9a7 7 0 0 1 7-7z" />
                  <path d="M9 22h6" />
                </svg>
              </div>
              <h1 className="font-display text-xl font-medium text-sage-900 tracking-tight">
                Neuroestima
              </h1>
            </div>

            {profesional && (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-sage-800 leading-tight">
                    {profesional.nombre}
                  </p>
                  <p className="text-xs text-sage-500">
                    {especialidadLabel[profesional.especialidad] || profesional.especialidad}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-sage-200 flex items-center justify-center text-sage-700 text-sm font-medium">
                  {profesional.nombre?.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={signOut}
                  className="text-sm text-sage-500 hover:text-clay-600 transition-colors cursor-pointer"
                >
                  Salir
                </button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex gap-1 -mb-px">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-teal-600 text-teal-700'
                      : 'border-transparent text-sage-500 hover:text-sage-700 hover:border-sage-300'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {profesional?.rol === 'admin' && adminNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-teal-600 text-teal-700'
                      : 'border-transparent text-sage-500 hover:text-sage-700 hover:border-sage-300'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-sage-200 py-4 text-center text-xs text-sage-400">
        Neuroestima &middot; Historias clínicas interdisciplinarias
      </footer>
    </div>
  )
}
