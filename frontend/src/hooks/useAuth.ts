/**
 * useAuth hook - wrapper around authStore for component usage
 */
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/services/api'

export const useAuth = () => {
  const store = useAuthStore()

  const login = async (username: string, password: string) => {
    try {
      // Call login API
      const data = await authApi.login(username, password)

      // Fetch user info
      // First set tokens so the API interceptor can use them
      store.setTokens(data.access_token, data.refresh_token)

      // Then fetch user details
      const user = await authApi.me()

      // Update store with full user info
      store.login(data.access_token, data.refresh_token, user)

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignore logout API errors
    }
    store.logout()
  }

  const checkAuth = async () => {
    if (!store.accessToken) {
      return false
    }

    try {
      const user = await authApi.me()
      store.login(store.accessToken, store.refreshToken || '', user)
      return true
    } catch {
      store.logout()
      return false
    }
  }

  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    accessToken: store.accessToken,
    hasPermission: store.hasPermission,
    isAdmin: () => store.user?.role === 'admin',
    login,
    logout,
    checkAuth,
  }
}

export default useAuth
