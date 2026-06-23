import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../views/LoginPage.vue'
import ProvinceList from '../views/ProvinceList.vue'
import PhotoManage from '../views/PhotoManage.vue'

export const router = createRouter({
  history: createWebHistory('/admin'),
  routes: [
    { path: '/login', name: 'login', component: LoginPage },
    { path: '/provinces', name: 'provinces', component: ProvinceList },
    { path: '/provinces/:code/photos', name: 'photos', component: PhotoManage },
    { path: '/', redirect: '/provinces' },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('admin_token')
  if (!token && to.name !== 'login') return { name: 'login' }
})
