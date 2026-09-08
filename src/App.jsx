import { Routes, Route } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import AuthProvider from './components/AuthProvider.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AppLayout from './components/AppLayout.jsx'
import Login from './pages/Login.jsx'
import Registro from './pages/Registro.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Pacientes from './pages/Pacientes.jsx'
import PacienteDetalle from './pages/PacienteDetalle.jsx'
import PacienteNuevo from './pages/PacienteNuevo.jsx'
import PacienteEditar from './pages/PacienteEditar.jsx'
import Respaldos from './pages/Respaldos.jsx'

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/pacientes" element={<Pacientes />} />
          <Route path="/pacientes/nuevo" element={<PacienteNuevo />} />
          <Route path="/pacientes/:id" element={<PacienteDetalle />} />
          <Route path="/pacientes/:id/editar" element={<PacienteEditar />} />
          <Route path="/respaldos" element={<Respaldos />} />
        </Route>
      </Routes>
    </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
