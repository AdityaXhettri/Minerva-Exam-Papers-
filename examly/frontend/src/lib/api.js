import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 180000, // 3 min — big PDF uploads + extraction need headroom
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('examly_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('examly_token')
      localStorage.removeItem('examly_user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
