<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAdminAuthStore } from '../stores/auth'

const authStore = useAdminAuthStore()
const router = useRouter()
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!password.value) return
  loading.value = true
  try {
    await authStore.login(password.value)
    router.push('/provinces')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">🏠</div>
      <h2>Secret Space</h2>
      <p class="login-subtitle">管理后台</p>
      <el-form @submit.prevent="handleLogin">
        <el-form-item>
          <el-input
            v-model="password"
            type="password"
            placeholder="请输入管理员密码"
            show-password
            size="large"
          />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" size="large" style="width:100%">
          登录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.login-card {
  width: 380px;
  padding: 40px 32px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  text-align: center;
}
.login-logo {
  font-size: 48px;
  margin-bottom: 8px;
}
h2 {
  margin: 0 0 4px;
  font-size: 22px;
  color: #1d1e2c;
}
.login-subtitle {
  margin: 0 0 28px;
  color: #999;
  font-size: 14px;
}
</style>
