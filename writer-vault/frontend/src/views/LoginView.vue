<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-logo">Writer Vault</h1>
      <p class="login-sub">本地化知识管理工作台</p>
      <el-form @submit.prevent>
        <el-input v-model="username" placeholder="用户名" size="large" />
        <el-input
          v-model="password"
          type="password"
          show-password
          placeholder="密码"
          size="large"
          @keyup.enter="submit"
        />
        <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="submit">
          登 录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)

/**
 * 提交登录：成功后写入令牌并进入工作台
 */
async function submit() {
  if (!username.value || !password.value) return
  loading.value = true
  try {
    const data = await http.post('/auth/login', { username: username.value, password: password.value })
    localStorage.setItem('token', data.token)
    localStorage.setItem('username', username.value)
    router.replace('/')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-base);
}
.login-card {
  width: min(360px, 90vw);
  padding: var(--space-5);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}
.login-logo {
  margin: 0;
  text-align: center;
  font-size: var(--fs-title);
  letter-spacing: 0.02em;
}
.login-sub {
  margin: var(--space-1) 0 var(--space-4);
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--fs-caption);
}
.login-card .el-input {
  margin-bottom: var(--space-3);
}
.login-btn {
  width: 100%;
}
</style>
