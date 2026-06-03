import { useState, useEffect } from 'preact/hooks'
import { api } from '../api/client'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.auth.me().then(data => {
      if (data && data.username) setUser(data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return { user, loading }
}
