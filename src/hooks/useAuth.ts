import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthState {
  loading: boolean
  user: { id: string; email?: string } | null
  profile: Profile | null
  isAdmin: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true,
    user: null,
    profile: null,
    isAdmin: false,
  })

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return

      if (!session?.user) {
        setState({ loading: false, user: null, profile: null, isAdmin: false })
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (!mounted) return
      setState({
        loading: false,
        user: { id: session.user.id, email: session.user.email },
        profile: profile ?? null,
        isAdmin: profile?.role === 'admin',
      })
    }

    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT' || !session) {
        setState({ loading: false, user: null, profile: null, isAdmin: false })
        return
      }
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
        if (!mounted) return
        setState({
          loading: false,
          user: { id: session.user.id, email: session.user.email },
          profile: profile ?? null,
          isAdmin: profile?.role === 'admin',
        })
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return state
}
