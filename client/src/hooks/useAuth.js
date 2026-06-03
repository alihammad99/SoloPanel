import { useState, useEffect } from 'preact/hooks'
import { api } from '../api/client'
import { serverInfo } from '../api/serverInfo'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.auth.me().then(data => {
      if (data && data.username) { setUser(data); serverInfo.baseURL = data.server_host || data.base_url || '' }
    }).catch(() => { }).finally(() => setLoading(false))
  }, [])

  return { user, loading }
}
