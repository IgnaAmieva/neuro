import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-sage-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-clay-500/10 flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c4704b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="font-display text-xl font-medium text-sage-900 mb-2">
              Algo salió mal
            </h2>
            <p className="text-sage-500 text-sm mb-6">
              Ocurrió un error inesperado. Podés intentar de nuevo o volver al inicio.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 px-5 rounded-lg text-sm transition-colors cursor-pointer"
              >
                Reintentar
              </button>
              <a
                href="/"
                className="text-sm font-medium text-sage-600 hover:text-sage-800 transition-colors"
              >
                Ir al inicio
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
