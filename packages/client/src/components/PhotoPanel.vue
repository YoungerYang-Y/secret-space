<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { apiFetch } from '../utils/apiFetch'

interface PhotoDto {
  id: number
  url: string
  annotation: string | null
  order: number
}

const props = defineProps<{
  provinceCode: string | null
  provinceName?: string
  originRect: DOMRect | null
}>()

const emit = defineEmits<{
  close: []
}>()

const photos = ref<PhotoDto[]>([])
const loading = ref(false)
const empty = ref(false)
const error = ref(false)
const title = computed(() => props.provinceName ?? props.provinceCode ?? '')
let requestVersion = 0

watch(
  () => props.provinceCode,
  async (code) => {
    if (!code) return
    const version = ++requestVersion
    loading.value = true
    empty.value = false
    error.value = false
    photos.value = []
    try {
      const res = await apiFetch(`/api/provinces/${code}/photos`)
      if (version !== requestVersion) return
      if (!res.ok) {
        error.value = true
        return
      }
      const data = await res.json()
      if (version !== requestVersion) return
      photos.value = data
      empty.value = data.length === 0
    } catch {
      if (version !== requestVersion) return
      error.value = true
    } finally {
      if (version === requestVersion) {
        loading.value = false
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="photo-panel">
    <div class="photo-panel-header">
      <h2 class="photo-panel-title">{{ title }}的照片</h2>
      <button class="photo-panel-close" @click="emit('close')">✕</button>
    </div>
    <div v-if="loading" class="photo-panel-state">正在加载照片...</div>
    <div v-else-if="error" class="photo-panel-state">照片加载失败，请稍后重试</div>
    <div v-else-if="empty" class="photo-panel-state">还没有照片</div>
    <div v-else class="photo-panel-grid">
      <div v-for="photo in photos" :key="photo.id" class="photo-item">
        <img :src="photo.url" :alt="photo.annotation || ''" loading="lazy" />
        <span v-if="photo.annotation" class="photo-annotation">{{ photo.annotation }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.photo-panel {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: rgba(255, 255, 255, 0.95);
  overflow-y: auto;
  padding: 16px;
}

.photo-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.photo-panel-title { margin: 0; font-size: 18px; color: #333; }

.photo-panel-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
}

.photo-panel-state {
  text-align: center;
  color: #999;
  padding: 40px 0;
}

.photo-panel-grid {
  columns: 2;
  column-gap: 8px;
}

.photo-item {
  break-inside: avoid;
  margin-bottom: 8px;
  position: relative;
}

.photo-item img {
  width: 100%;
  border-radius: 6px;
  display: block;
}

.photo-annotation {
  position: absolute;
  bottom: 4px;
  left: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.photo-item:hover .photo-annotation,
.photo-item:focus-within .photo-annotation { opacity: 1; }

@media (hover: none) {
  .photo-annotation { opacity: 1; }
}
</style>
