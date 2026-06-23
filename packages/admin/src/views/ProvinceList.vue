<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
    ElMessage.success(`${row.name} ${row.visited ? '已标记' : '已取消'}`)
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
  <div style="padding: 24px">
    <h2>省份管理</h2>
    <el-table :data="provinces" v-loading="loading" stripe>
      <el-table-column prop="name" label="省份" width="120" />
      <el-table-column prop="code" label="编码" width="140" />
      <el-table-column label="已去过" width="100">
        <template #default="{ row }">
          <el-switch v-model="row.visited" @change="toggleVisited(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="photoCount" label="照片数" width="100" />
      <el-table-column label="操作">
        <template #default="{ row }">
          <el-button size="small" @click="goPhotos(row.code)">管理照片</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
