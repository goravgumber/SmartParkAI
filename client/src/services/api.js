import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || '/api'

function getToken() {
  try {
    return localStorage.getItem('smartpark_token') || ''
  } catch {
    return ''
  }
}

export const publicApi = axios.create({
  baseURL,
  timeout: 15000
})

export const api = axios.create({
  baseURL,
  timeout: 15000
})

api.interceptors.request.use(
  (request) => {
    const token = getToken()
    if (token) {
      request.headers.Authorization = `Bearer ${token}`
    }
    return request
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      try {
        localStorage.removeItem('smartpark_token')
        localStorage.removeItem('smartpark_user')
      } catch {
        // Ignore storage errors.
      }

      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)
