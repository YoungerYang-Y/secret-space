<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAdminAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAdminAuthStore()

function logout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <el-container class="layout">
    <el-aside width="200px" class="aside">
      <div class="logo">🏠 Secret Space</div>
      <el-menu :default-active="$route.path" router class="menu">
        <el-menu-item index="/provinces">
          <el-icon><i class="el-icon-map-location" /></el-icon>
          <span>省份管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span class="header-title">管理后台</span>
        <el-button text @click="logout">退出登录</el-button>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100vh;
}
.aside {
  background: #1d1e2c;
  display: flex;
  flex-direction: column;
}
.logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.menu {
  border-right: none;
  background: transparent;
  --el-menu-bg-color: transparent;
  --el-menu-text-color: rgba(255,255,255,0.7);
  --el-menu-hover-bg-color: rgba(255,255,255,0.06);
  --el-menu-active-color: #409eff;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
}
.header-title {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}
.main {
  background: #f5f7fa;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.main :deep(.el-main) {
  flex: 1;
}
</style>
