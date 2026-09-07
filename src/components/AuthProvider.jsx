import { createContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export const AuthContext = createContext(null)

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profesional, setProfesional] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfesional(userId) {
    const { data } = await supabase
      .from('profesionales')
      .select('*')
      .eq('auth_user_id', userId)
      .single()
    setProfesional(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchProfesional(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session?.user) {
          fetchProfesional(session.user.id)
        } else {
          setProfesional(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setProfesional(null)
  }

  return (
    <AuthContext.Provider value={{ session, profesional, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
