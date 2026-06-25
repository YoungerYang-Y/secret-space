<script setup lang="ts">
import { onMounted } from 'vue'
import gsap from 'gsap'
import { useAlbumStore } from '../stores/album'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'open-album': [albumId: string]
}>()

const albumStore = useAlbumStore()

onMounted(async () => {
  if (albumStore.albums.length === 0) {
    await albumStore.fetchAlbums()
  }
})

function onSpineEnter(el: HTMLElement) {
  gsap.to(el, { y: -15, boxShadow: '0 -4px 12px rgba(0,0,0,0.3)', duration: 0.3, ease: 'power2.out' })
}

function onSpineLeave(el: HTMLElement) {
  gsap.to(el, { y: 0, boxShadow: 'none', duration: 0.3, ease: 'power2.out' })
}
</script>

<template>
  <div v-show="visible" class="bookshelf-overlay">
    <div v-if="albumStore.albums.length === 0" class="bookshelf-empty">
      还没有相册哦～
    </div>
    <div v-else class="bookshelf-spines">
      <div
        v-for="album in albumStore.albums"
        :key="album.id"
        class="spine"
        role="button"
        :aria-label="`打开 ${album.year} 年相册`"
        :style="{ backgroundColor: albumStore.getSpineColor(album.year) }"
        @pointerenter="onSpineEnter($event.currentTarget as HTMLElement)"
        @pointerleave="onSpineLeave($event.currentTarget as HTMLElement)"
        @click="emit('open-album', album.id)"
      >
        <span class="spine-year">{{ album.year }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bookshelf-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  pointer-events: auto;
  background: rgba(245, 240, 235, 0.95);
  padding-bottom: 10%;
}

.bookshelf-empty {
  font-size: 18px;
  color: #999;
  text-align: center;
}

.bookshelf-spines {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 60%;
  overflow-x: auto;
  padding: 0 16px;
}

.spine {
  width: 45px;
  min-width: 45px;
  height: 100%;
  border-radius: 3px 3px 0 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset -2px 0 4px rgba(0, 0, 0, 0.15);
}

.spine:active {
  transform: translateY(-8px);
  opacity: 0.85;
}

.spine-year {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  letter-spacing: 2px;
}
</style>
