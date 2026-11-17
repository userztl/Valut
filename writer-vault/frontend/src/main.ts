import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import router from './router'
import './styles/main.css'

// 全局禁用浏览器默认右键菜单（自定义菜单自行监听 contextmenu 事件）
document.addEventListener('contextmenu', (e) => e.preventDefault())

createApp(App).use(createPinia()).use(router).use(ElementPlus).mount('#app')
