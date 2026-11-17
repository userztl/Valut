import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/', redirect: '/doc' },
    { path: '/doc', component: () => import('@/views/DocView.vue') },
    { path: '/canvas', component: () => import('@/views/CanvasView.vue') },
    { path: '/setting', component: () => import('@/views/SettingView.vue') }
  ]
})

/**
 * 路由守卫：未登录统一跳转登录页
 */
router.beforeEach((to) => {
  if (!to.meta.public && !localStorage.getItem('token')) {
    return '/login'
  }
})

export default router
