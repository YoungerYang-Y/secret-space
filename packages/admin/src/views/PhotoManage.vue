<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAdminAuthStore } from '../stores/auth'

interface Photo {
  id: number
  url: string
  annotation: string | null
  order: number
}

const route = useRoute()
const authStore = useAdminAuthStore()
const code = route.params.code as string
const photos = ref<Photo[]>([])
const uploading = ref(false)

function headers() {
  return { Authorization: `Bearer ${authStore.token}` }
}

async function fetchPhotos() {
  const res = await axios.get(`/provinces/${code}/photos`)
  photos.value = res.data
}

async function handleUpload(file: File) {
  uploading.value = true
  try {
    const presignRes = await axios.post('/photos/presign', {
      provinceCode: code,
      filename: file.name,
      contentType: file.type,
    }, { headers: headers() })

    await axios.put(presignRes.data.uploadUrl, file, {
      headers: { 'Content-Type': file.type },
    })

    await axios.post('/photos', {
      provinceCode: code,
      url: presignRes.data.publicUrl,
      order: photos.value.length,
    }, { headers: headers() })

    ElMessage.success('上传成功')
    await fetchPhotos()
  } catch {
    ElMessage.error('上传失败')
  } finally {
    uploading.value = false
  }
}

function onFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files?.[0]) handleUpload(files[0])
}

async function updateAnnotation(photo: Photo) {
  const { value } = await ElMessageBox.prompt('编辑标注', '标注', {
    inputValue: photo.annotation || '',
  })
  await axios.put(`/photos/${photo.id}`, { annotation: value }, { headers: headers() })
  photo.annotation = value
  ElMessage.success('已更新')
}

async function deletePhoto(photo: Photo) {
  await ElMessageBox.confirm('确认删除这张照片？', '删除')
  await axios.delete(`/photos/${photo.id}`, { headers: headers() })
  ElMessage.success('已删除')
  await fetchPhotos()
}

async function saveOrder() {
  const photoIds = photos.value.map((p) => p.id)
  await axios.put('/photos/reorder', { provinceCode: code, photoIds }, { headers: headers() })
  ElMessage.success('排序已保存')
}

onMounted(fetchPhotos)
</script>

<template>
  <div style="padding: 24px">
    <h2>照片管理 - {{ code }}</h2>
    <div style="margin-bottom: 16px">
      <input type="file" accept="image/*" @change="onFileChange" :disabled="uploading" />
      <el-button v-if="photos.length > 1" type="success" size="small" style="margin-left: 12px" @click="saveOrder">保存排序</el-button>
    </div>
    <div class="photo-grid">
      <div v-for="(photo, index) in photos" :key="photo.id" class="photo-card">
        <img :src="photo.url" />
        <div class="photo-actions">
          <el-button size="small" @click="updateAnnotation(photo)">标注</el-button>
          <el-button size="small" type="danger" @click="deletePhoto(photo)">删除</el-button>
        </div>
        <div v-if="photo.annotation" class="photo-ann">{{ photo.annotation }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.photo-card {
  border: 1px solid #eee;
  border-radius: 6px;
  overflow: hidden;
}
.photo-card img {
  width: 100%;
  display: block;
}
.photo-actions {
  padding: 8px;
  display: flex;
  gap: 8px;
}
.photo-ann {
  padding: 4px 8px;
  font-size: 12px;
  color: #666;
}
</style>
