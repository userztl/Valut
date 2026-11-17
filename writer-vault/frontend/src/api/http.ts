import axios from 'axios'
import { ElMessage } from 'element-plus'

/**
 * 统一 axios 实例：业务提示文案全部由后端下发，前端仅负责拦截、展示与交互
 * 后端响应约定：{ code: number, message: string, data: any }，code === 0 表示成功
 */
const http = axios.create({
  baseURL: '/api',
  timeout: 15000
})

/**
 * 请求拦截：自动携带会话令牌
 */
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/**
 * 跳转登录页（避免循环重定向）
 */
function redirectToLogin() {
  localStorage.removeItem('token')
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login')
  }
}

http.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && typeof body === 'object' && 'code' in body && body.code !== 0) {
      // 401 视为登录态失效，静默跳转登录页
      if (body.code === 401) {
        redirectToLogin()
        return Promise.reject(new Error(body.message))
      }
      ElMessage.error(body.message)
      return Promise.reject(new Error(body.message))
    }
    return body?.data !== undefined ? body.data : body
  },
  (err) => {
    if (err?.response?.status === 401) {
      redirectToLogin()
      return Promise.reject(err)
    }
    ElMessage.error(err?.response?.data?.message || '网络异常，请稍后重试')
    return Promise.reject(err)
  }
)

export default http
