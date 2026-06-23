<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import draggable from 'vuedraggable'
import { useAdminAuthStore } from '../stores/auth'

interface Photo {
  id: number
  url: string
  annotation: string | null
  order: number
}

const route = useRoute()
const router = useRouter()
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
      key: presignRes.data.key,
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
  <div class="page">
    <div class="page-header">
      <div class="header-left">
        <el-button text @click="router.push('/provinces')">← 返回</el-button>
        <h2>{{ code }} · 照片管理</h2>
      </div>
      <div class="header-right">
        <span class="photo-count">{{ photos.length }} 张照片</span>
      </div>
    </div>

    <el-card shadow="never" class="upload-card">
      <label class="upload-area" :class="{ disabled: uploading }">
        <input type="file" accept="image/*" @change="onFileChange" :disabled="uploading" />
        <span v-if="uploading">上传中...</span>
        <span v-else>📷 点击上传照片</span>
      </label>
      <p class="upload-tip">拖拽照片卡片可调整排序，松手自动保存</p>
    </el-card>

    <div v-if="photos.length === 0 && !uploading" class="empty">
      <p>暂无照片，点击上方上传</p>
    </div>

    <draggable v-model="photos" item-key="id" class="photo-grid" @end="saveOrder">
      <template #item="{ element: photo }">
        <div class="photo-card">
          <div class="photo-img-wrap">
            <img :src="photo.url" loading="lazy" />
          </div>
          <div class="photo-footer">
            <span class="photo-ann">{{ photo.annotation || '无标注' }}</span>
            <div class="photo-actions">
              <el-button type="primary" text size="small" @click="updateAnnotation(photo)">标注</el-button>
              <el-button type="danger" text size="small" @click="deletePhoto(photo)">删除</el-button>
            </div>
          </div>
        </div>
      </template>
    </draggable>
  </div>
</template>

<style scoped>
.page {
  padding: 0;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.header-left h2 {
  margin: 0;
  font-size: 20px;
  color: #1d1e2c;
}
.photo-count {
  color: #999;
  font-size: 14px;
}
.upload-card {
  margin-bottom: 20px;
}
.upload-area {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  cursor: pointer;
  color: #666;
  font-size: 15px;
  transition: border-color 0.2s, background 0.2s;
}
.upload-area:hover {
  border-color: #409eff;
  background: #f0f7ff;
}
.upload-area.disabled {
  opacity: 0.5;
  pointer-events: none;
}
.upload-area input {
  display: none;
}
.upload-tip {
  margin: 8px 0 0;
  font-size: 12px;
  color: #bbb;
}
.empty {
  text-align: center;
  padding: 60px 0;
  color: #ccc;
  font-size: 14px;
}
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.photo-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  cursor: grab;
  transition: box-shadow 0.2s, transform 0.2s;
}
.photo-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}
.photo-img-wrap {
  aspect-ratio: 4/3;
  overflow: hidden;
  background: #f5f5f5;
}
.photo-img-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-footer {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.photo-ann {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100px;
}
.photo-actions {
  display: flex;
  gap: 4px;
}
</style>
