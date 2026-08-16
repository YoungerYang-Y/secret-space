<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { compressImage } from '../utils/compress'

const router = useRouter()

interface Album {
  id: string
  year: number
  title: string | null
  coverUrl: string | null
  createdAt: string
}

type AlbumPayload = Pick<Album, 'year' | 'title'> & { coverUploadReceipt?: string }

function errorMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError<{ message?: string }>(error)
    ? error.response?.data?.message ?? fallback
    : fallback
}

const albums = ref<Album[]>([])
const dialogVisible = ref(false)
const editingAlbum = ref<Album | null>(null)
const form = ref({ year: new Date().getFullYear(), title: '', coverUploadReceipt: '', coverPreviewUrl: '' })
const submitting = ref(false)

async function fetchAlbums() {
  const res = await axios.get<Album[]>('/albums')
  albums.value = res.data
}

function openCreate() {
  editingAlbum.value = null
  form.value = { year: new Date().getFullYear(), title: '', coverUploadReceipt: '', coverPreviewUrl: '' }
  dialogVisible.value = true
}

function openEdit(album: Album) {
  editingAlbum.value = album
  form.value = {
    year: album.year,
    title: album.title || '',
    coverUploadReceipt: '',
    coverPreviewUrl: album.coverUrl || '',
  }
  dialogVisible.value = true
}

async function handleSubmit() {
  if (submitting.value) return
  submitting.value = true
  try {
    const payload: AlbumPayload = { year: form.value.year, title: form.value.title }
    if (form.value.coverUploadReceipt) {
      payload.coverUploadReceipt = form.value.coverUploadReceipt
    }
    if (editingAlbum.value) {
      await axios.put(`/albums/${editingAlbum.value.id}`, payload)
    } else {
      await axios.post('/albums', payload)
    }
    dialogVisible.value = false
    await fetchAlbums()
    ElMessage.success('保存成功')
  } catch (error: unknown) {
    ElMessage.error(errorMessage(error, '保存失败'))
  } finally {
    submitting.value = false
  }
}

async function handleDelete(album: Album) {
  try {
    await ElMessageBox.confirm(`确定删除 ${album.year} 年的相册吗？`, '确认')
  } catch {
    return
  }
  try {
    await axios.delete(`/albums/${album.id}`)
    await fetchAlbums()
    ElMessage.success('删除成功')
  } catch (error: unknown) {
    ElMessage.error(errorMessage(error, '删除失败'))
  }
}

onMounted(fetchAlbums)

async function handleCoverUpload(file: File) {
  try {
    const compressed = await compressImage(file)

    // Step 1: Get presigned upload URL
    const presignRes = await axios.post('/albums/presign', {
      filename: `cover-${Date.now()}.webp`,
      contentType: 'image/webp',
    })

    const { uploadUrl, key } = presignRes.data

    // Step 2: PUT to presigned URL (不需要 Cookie)
    await fetch(uploadUrl, { method: 'PUT', body: compressed, headers: { 'Content-Type': 'image/webp' } })

    // Step 3: Confirm upload to get an opaque receipt and short-lived preview
    const confirmRes = await axios.post('/media/confirm', { key })
    const { uploadReceipt, readUrl } = confirmRes.data

    // Step 4: Update form state
    form.value.coverUploadReceipt = uploadReceipt
    form.value.coverPreviewUrl = readUrl
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
          <div v-if="form.coverPreviewUrl" style="margin-bottom:8px">
            <el-image :src="form.coverPreviewUrl" style="width:80px;height:80px" fit="cover" />
          </div>
          <el-upload
            :show-file-list="false"
            :before-upload="handleCoverUpload"
            accept="image/*"
          >
            <el-button size="small">{{ form.coverPreviewUrl ? '替换封面' : '上传封面' }}</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
