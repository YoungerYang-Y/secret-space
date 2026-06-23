<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useAdminAuthStore } from '../stores/auth'

interface Province {
  code: string
  name: string
  visited: boolean
  photoCount: number
}

const authStore = useAdminAuthStore()
const router = useRouter()
const provinces = ref<Province[]>([])
const loading = ref(false)

const visitedCount = computed(() => provinces.value.filter(p => p.visited).length)
const totalPhotos = computed(() => provinces.value.reduce((sum, p) => sum + p.photoCount, 0))

function headers() {
  return { Authorization: `Bearer ${authStore.token}` }
}

async function fetchProvinces() {
  loading.value = true
  try {
    const res = await axios.get('/provinces')
    provinces.value = res.data
  } finally {
    loading.value = false
  }
}

async function toggleVisited(row: Province) {
  try {
    await axios.put(`/provinces/${row.code}`, { visited: row.visited }, { headers: headers() })
    ElMessage.success(`${row.name} ${row.visited ? '已点亮' : '已取消'}`)
  } catch {
    row.visited = !row.visited
    ElMessage.error('操作失败')
  }
}

function goPhotos(code: string) {
  router.push(`/provinces/${code}/photos`)
}

onMounted(fetchProvinces)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h2>省份管理</h2>
      <div class="stats">
        <div class="stat-item">
          <span class="stat-value">{{ visitedCount }}</span>
          <span class="stat-label">已点亮</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ provinces.length }}</span>
          <span class="stat-label">总省份</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ totalPhotos }}</span>
          <span class="stat-label">照片总数</span>
        </div>
      </div>
    </div>
    <el-card shadow="never" class="table-card">
      <el-table :data="provinces" v-loading="loading" stripe height="100%">
        <el-table-column prop="name" label="省份" min-width="100" />
        <el-table-column prop="code" label="编码" min-width="120" />
        <el-table-column label="已去过" width="80" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.visited" @change="toggleVisited(row)" />
          </template>
        </el-table-column>
        <el-table-column prop="photoCount" label="照片数" width="80" align="center" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="primary" text size="small" @click="goPhotos(row.code)">管理照片</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.page-header h2 {
  margin: 0;
  font-size: 20px;
  color: #1d1e2c;
}
.stats {
  display: flex;
  gap: 24px;
}
.stat-item {
  text-align: center;
}
.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: #409eff;
}
.stat-label {
  font-size: 12px;
  color: #999;
}
.table-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.table-card :deep(.el-card__body) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
