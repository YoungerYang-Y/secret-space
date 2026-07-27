import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import axios from 'axios'
import App from './App.vue'
import { router } from './router'
import { useAdminAuthStore } from './stores/auth'

axios.defaults.baseURL = '/api'
axios.defaults.withCredentials = true

axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && router.currentRoute.value.path !== '/login') {
      const authStore = useAdminAuthStore()
      authStore.role = null
      authStore.initialized = false
      router.push('/login')
    }
    return Promise.reject(err)
  },
)

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(ElementPlus)
app.mount('#app')
