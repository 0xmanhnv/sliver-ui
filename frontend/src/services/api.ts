import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = useAuthStore.getState().refreshToken

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          })

          const { access_token, refresh_token } = response.data
          useAuthStore.getState().setTokens(access_token, refresh_token)

          // Retry original request
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`
          }
          return api(originalRequest)
        } catch (refreshError) {
          // Refresh failed, logout user
          useAuthStore.getState().logout()
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      }
    }

    return Promise.reject(error)
  }
)

// API functions

// Auth
export const authApi = {
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password })
    return response.data
  },

  logout: async () => {
    await api.post('/auth/logout')
  },

  me: async () => {
    const response = await api.get('/auth/me')
    return response.data
  },
}

// Sessions
export const sessionsApi = {
  list: async () => {
    const response = await api.get('/sessions')
    return response.data
  },

  get: async (id: string) => {
    const response = await api.get(`/sessions/${id}`)
    return response.data
  },

  kill: async (id: string) => {
    const response = await api.delete(`/sessions/${id}`)
    return response.data
  },

  shell: async (id: string, command: string, timeout = 60) => {
    const response = await api.post(`/sessions/${id}/shell`, { command, timeout })
    return response.data
  },

  processes: async (id: string) => {
    const response = await api.get(`/sessions/${id}/processes`)
    return response.data
  },

  killProcess: async (sessionId: string, pid: number) => {
    const response = await api.post(`/sessions/${sessionId}/processes/${pid}/kill`)
    return response.data
  },

  files: async (id: string, path: string) => {
    const response = await api.get(`/sessions/${id}/files`, { params: { path } })
    return response.data
  },

  screenshot: async (id: string) => {
    const response = await api.get(`/sessions/${id}/screenshot`, {
      responseType: 'blob',
    })
    return response.data
  },

  upload: async (id: string, remotePath: string, file: File) => {
    const response = await api.post(
      `/sessions/${id}/files/upload?remote_path=${encodeURIComponent(remotePath)}`,
      file,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      }
    )
    return response.data
  },

  mkdir: async (id: string, path: string) => {
    const response = await api.post(`/sessions/${id}/mkdir?path=${encodeURIComponent(path)}`)
    return response.data
  },

  deleteFile: async (id: string, path: string) => {
    const response = await api.delete(`/sessions/${id}/files?path=${encodeURIComponent(path)}`)
    return response.data
  },

  download: async (id: string, path: string) => {
    const response = await api.get(`/sessions/${id}/files/download?path=${encodeURIComponent(path)}`, {
      responseType: 'blob',
    })
    return response.data
  },

  // Pivoting operations
  listPivots: async (id: string) => {
    const response = await api.get(`/sessions/${id}/pivots`)
    return response.data
  },

  startSocks: async (id: string, host: string = '127.0.0.1', port: number = 1080) => {
    const response = await api.post(`/sessions/${id}/socks`, { host, port })
    return response.data
  },

  stopSocks: async (sessionId: string, tunnelId: number) => {
    const response = await api.delete(`/sessions/${sessionId}/socks/${tunnelId}`)
    return response.data
  },

  startPortfwd: async (
    id: string,
    remoteHost: string,
    remotePort: number,
    localHost: string = '127.0.0.1',
    localPort: number = 0
  ) => {
    const response = await api.post(`/sessions/${id}/portfwd`, {
      remote_host: remoteHost,
      remote_port: remotePort,
      local_host: localHost,
      local_port: localPort,
    })
    return response.data
  },

  stopPortfwd: async (sessionId: string, tunnelId: number) => {
    const response = await api.delete(`/sessions/${sessionId}/portfwd/${tunnelId}`)
    return response.data
  },
}

// Beacons
export const beaconsApi = {
  list: async () => {
    const response = await api.get('/beacons')
    return response.data
  },

  get: async (id: string) => {
    const response = await api.get(`/beacons/${id}`)
    return response.data
  },

  kill: async (id: string) => {
    const response = await api.delete(`/beacons/${id}`)
    return response.data
  },

  // Task operations
  getTasks: async (id: string) => {
    const response = await api.get(`/beacons/${id}/tasks`)
    return response.data
  },

  getTask: async (beaconId: string, taskId: string) => {
    const response = await api.get(`/beacons/${beaconId}/tasks/${taskId}`)
    return response.data
  },

  queueShell: async (id: string, command: string) => {
    const response = await api.post(`/beacons/${id}/tasks/shell`, { command })
    return response.data
  },

  queuePs: async (id: string) => {
    const response = await api.post(`/beacons/${id}/tasks/ps`)
    return response.data
  },

  queueScreenshot: async (id: string) => {
    const response = await api.post(`/beacons/${id}/tasks/screenshot`)
    return response.data
  },

  queueDownload: async (id: string, remotePath: string) => {
    const response = await api.post(`/beacons/${id}/tasks/download`, { remote_path: remotePath })
    return response.data
  },
}

// Listeners
export const listenersApi = {
  list: async () => {
    const response = await api.get('/listeners')
    return response.data
  },

  startMtls: async (host: string, port: number) => {
    const response = await api.post('/listeners/mtls', { host, port })
    return response.data
  },

  startHttps: async (config: {
    host: string
    port: number
    domain: string
    website?: string
    letsencrypt?: boolean
  }) => {
    const response = await api.post('/listeners/https', config)
    return response.data
  },

  startHttp: async (config: { host: string; port: number; domain?: string }) => {
    const response = await api.post('/listeners/http', config)
    return response.data
  },

  startDns: async (config: {
    domains: string[]
    host: string
    port: number
    canaries?: boolean
  }) => {
    const response = await api.post('/listeners/dns', config)
    return response.data
  },

  stop: async (id: string) => {
    const response = await api.delete(`/listeners/${id}`)
    return response.data
  },
}

// Implants
export const implantsApi = {
  generate: async (config: {
    name: string
    os: string
    arch: string
    format: string
    c2: { protocol: string; host: string; port: number }[]
    beacon?: boolean
    interval?: number
    jitter?: number
    debug?: boolean
    evasion?: boolean
  }) => {
    const response = await api.post('/implants/generate', config)
    return response.data
  },

  download: async (key: string) => {
    const response = await api.get(`/implants/${key}/download`, {
      responseType: 'blob',
    })
    return response.data
  },

  delete: async (key: string) => {
    const response = await api.delete(`/implants/${key}`)
    return response.data
  },
}

// Notes & Tags
export const notesApi = {
  // Notes
  getSessionNotes: async (sessionId: string, sessionType: string = 'session') => {
    const response = await api.get(`/notes/sessions/${sessionId}/notes`, {
      params: { session_type: sessionType },
    })
    return response.data
  },

  createNote: async (sessionId: string, content: string, sessionType: string = 'session') => {
    const response = await api.post(`/notes/sessions/${sessionId}/notes`, {
      session_id: sessionId,
      session_type: sessionType,
      content,
    })
    return response.data
  },

  updateNote: async (noteId: number, content: string) => {
    const response = await api.put(`/notes/notes/${noteId}`, { content })
    return response.data
  },

  deleteNote: async (noteId: number) => {
    const response = await api.delete(`/notes/notes/${noteId}`)
    return response.data
  },

  // Tags
  listTags: async () => {
    const response = await api.get('/notes/tags')
    return response.data
  },

  createTag: async (name: string, color: string = '#6366f1', description?: string) => {
    const response = await api.post('/notes/tags', { name, color, description })
    return response.data
  },

  deleteTag: async (tagId: number) => {
    const response = await api.delete(`/notes/tags/${tagId}`)
    return response.data
  },

  getSessionTags: async (sessionId: string, sessionType: string = 'session') => {
    const response = await api.get(`/notes/sessions/${sessionId}/tags`, {
      params: { session_type: sessionType },
    })
    return response.data
  },

  addTagToSession: async (sessionId: string, tagId: number, sessionType: string = 'session') => {
    const response = await api.post(
      `/notes/sessions/${sessionId}/tags/${tagId}`,
      {},
      { params: { session_type: sessionType } }
    )
    return response.data
  },

  removeTagFromSession: async (sessionId: string, tagId: number, sessionType: string = 'session') => {
    const response = await api.delete(`/notes/sessions/${sessionId}/tags/${tagId}`, {
      params: { session_type: sessionType },
    })
    return response.data
  },

  // Command History
  getCommandHistory: async (sessionId: string, limit: number = 100) => {
    const response = await api.get(`/notes/sessions/${sessionId}/history`, {
      params: { limit },
    })
    return response.data
  },

  saveCommand: async (
    sessionId: string,
    command: string,
    output?: string,
    exitCode?: number,
    sessionType: string = 'session'
  ) => {
    const response = await api.post(`/notes/sessions/${sessionId}/history`, null, {
      params: { command, output, exit_code: exitCode, session_type: sessionType },
    })
    return response.data
  },

  // Export
  exportSessionData: async (sessionId: string) => {
    const response = await api.get(`/notes/sessions/${sessionId}/export`)
    return response.data
  },
}

// Armory (extensions)
export const armoryApi = {
  list: async (installedOnly = false, search?: string) => {
    const response = await api.get('/armory', {
      params: {
        installed_only: installedOnly,
        search,
      },
    })
    return response.data
  },

  install: async (packageName: string) => {
    const response = await api.post('/armory/install', { package_name: packageName })
    return response.data
  },

  uninstall: async (packageName: string) => {
    const response = await api.post('/armory/uninstall', { package_name: packageName })
    return response.data
  },
}

// Cleanup
export const cleanupApi = {
  getStatus: async (staleThreshold = 1440, missedCheckins = 10) => {
    const response = await api.get('/cleanup/status', {
      params: {
        stale_threshold_minutes: staleThreshold,
        missed_checkins_threshold: missedCheckins,
      },
    })
    return response.data
  },

  bulkKillSessions: async (ids: string[]) => {
    const response = await api.post('/cleanup/sessions/bulk-kill', { ids })
    return response.data
  },

  bulkKillBeacons: async (ids: string[]) => {
    const response = await api.post('/cleanup/beacons/bulk-kill', { ids })
    return response.data
  },

  killAllSessions: async () => {
    const response = await api.post('/cleanup/sessions/kill-all')
    return response.data
  },

  killAllBeacons: async () => {
    const response = await api.post('/cleanup/beacons/kill-all')
    return response.data
  },

  killAllJobs: async () => {
    const response = await api.post('/cleanup/jobs/kill-all')
    return response.data
  },

  killEverything: async () => {
    const response = await api.post('/cleanup/kill-everything')
    return response.data
  },
}

// Users (admin)
export const usersApi = {
  list: async () => {
    const response = await api.get('/users')
    return response.data
  },

  create: async (data: {
    username: string
    email?: string
    password: string
    role_id: number
  }) => {
    const response = await api.post('/users', data)
    return response.data
  },

  update: async (
    id: number,
    data: {
      username?: string
      email?: string
      password?: string
      role_id?: number
      is_active?: boolean
    }
  ) => {
    const response = await api.put(`/users/${id}`, data)
    return response.data
  },

  delete: async (id: number) => {
    const response = await api.delete(`/users/${id}`)
    return response.data
  },

  roles: async () => {
    const response = await api.get('/users/roles')
    return response.data
  },
}

export default api
