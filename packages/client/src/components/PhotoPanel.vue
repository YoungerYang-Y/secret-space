<script setup lang="ts">
import { ref, watch } from 'vue'

interface PhotoDto {
  id: number
  url: string
  annotation: string | null
  order: number
}

const props = defineProps<{
  provinceCode: string | null
  originRect: DOMRect | null
}>()

const emit = defineEmits<{
  close: []
}>()

const photos = ref<PhotoDto[]>([])
const loading = ref(false)
const empty = ref(false)

watch(
  () => props.provinceCode,
  async (code) => {
    if (!code) return
    loading.value = true
    empty.value = false
    try {
      const res = await fetch(`/provinces/${code}/photos`)
      const data = await res.json()
      photos.value = data
      empty.value = data.length === 0
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="photo-panel">
    <div class="photo-panel-header">
      <button class="photo-panel-close" @click="emit('close')">✕</button>
    </div>
    <div v-if="empty" class="photo-panel-empty">还没有照片</div>
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
  justify-content: flex-end;
  margin-bottom: 12px;
}

.photo-panel-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
}

.photo-panel-empty {
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
}
</style>
