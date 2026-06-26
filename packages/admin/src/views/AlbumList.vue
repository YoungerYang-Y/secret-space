<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { compressImage } from '../utils/compress'
import { useAdminAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAdminAuthStore()

interface Album {
  id: string
  year: number
  title: string | null
  coverUrl: string | null
  createdAt: string
}

const albums = ref<Album[]>([])
const dialogVisible = ref(false)
const editingAlbum = ref<Album | null>(null)
const form = ref({ year: new Date().getFullYear(), title: '', coverUrl: '' })

function getHeaders() {
  return { Authorization: `Bearer ${authStore.token}` }
}

async function fetchAlbums() {
  const res = await axios.get('/albums')
  albums.value = res.data
}

function openCreate() {
  editingAlbum.value = null
  form.value = { year: new Date().getFullYear(), title: '', coverUrl: '' }
  dialogVisible.value = true
}

function openEdit(album: Album) {
  editingAlbum.value = album
  form.value = { year: album.year, title: album.title || '', coverUrl: album.coverUrl || '' }
  dialogVisible.value = true
}

async function handleSubmit() {
  try {
    if (editingAlbum.value) {
      await axios.put(`/albums/${editingAlbum.value.id}`, form.value, { headers: getHeaders() })
    } else {
      await axios.post('/albums', form.value, { headers: getHeaders() })
    }
    dialogVisible.value = false
    await fetchAlbums()
    ElMessage.success('保存成功')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败')
  }
}

async function handleDelete(album: Album) {
  try {
    await ElMessageBox.confirm(`确定删除 ${album.year} 年的相册吗？`, '确认')
  } catch {
    return
  }
  try {
    await axios.delete(`/albums/${album.id}`, { headers: getHeaders() })
    await fetchAlbums()
    ElMessage.success('删除成功')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

onMounted(fetchAlbums)

async function handleCoverUpload(file: File) {
  try {
    const compressed = await compressImage(file)
    // 使用 album 专用 presign 端点
    const presignRes = await axios.post('/albums/presign', {
      filename: `cover-${Date.now()}.webp`,
      contentType: 'image/webp',
    }, { headers: getHeaders() })
    await fetch(presignRes.data.uploadUrl, { method: 'PUT', body: compressed, headers: { 'Content-Type': 'image/webp' } })
    form.value.coverUrl = presignRes.data.publicUrl
    ElMessage.success('封面已上传')
  } catch {
    ElMessage.error('封面上传失败')
  }
  return false
}
</script>

<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="margin:0">相册管理</h2>
      <el-button type="primary" @click="openCreate">新建相册</el-button>
    </div>

    <el-table :data="albums" stripe>
      <el-table-column prop="year" label="年份" width="100" />
      <el-table-column prop="title" label="标题" />
      <el-table-column label="封面" width="100">
        <template #default="{ row }">
          <el-image v-if="row.coverUrl" :src="row.coverUrl" style="width:40px;height:40px" fit="cover" />
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240">
        <template #default="{ row }">
          <el-button size="small" @click="router.push(`/albums/${row.id}/pages`)">编辑页面</el-button>
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingAlbum ? '编辑相册' : '新建相册'" width="400px">
      <el-form :model="form" label-width="60px">
        <el-form-item label="年份">
          <el-input-number v-model="form.year" :min="2000" :max="2099" />
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="可选，如：2024年的回忆" />
        </el-form-item>
        <el-form-item label="封面">
          <div v-if="form.coverUrl" style="margin-bottom:8px">
            <el-image :src="form.coverUrl" style="width:80px;height:80px" fit="cover" />
          </div>
          <el-upload
            :show-file-list="false"
            :before-upload="handleCoverUpload"
            accept="image/*"
          >
            <el-button size="small">{{ form.coverUrl ? '替换封面' : '上传封面' }}</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
