import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin" />
          <span className="text-sage-500 text-sm tracking-wide">Cargando...</span>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return children
}
