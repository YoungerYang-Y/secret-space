<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { PageFlip } from 'page-flip'
import type { AlbumDto, PageDto } from '../stores/album'
import { audioManager } from '../audio/AudioManager'
import SingleTemplate from './templates/SingleTemplate.vue'
import DoubleHTemplate from './templates/DoubleHTemplate.vue'
import DoubleVTemplate from './templates/DoubleVTemplate.vue'
import TripleTemplate from './templates/TripleTemplate.vue'
import PhotoTextTemplate from './templates/PhotoTextTemplate.vue'
import CoverPage from './templates/CoverPage.vue'
import BackCoverPage from './templates/BackCoverPage.vue'

const props = defineProps<{
  album: AlbumDto
  pages: PageDto[]
}>()

const emit = defineEmits<{ close: [] }>()

const bookRef = ref<HTMLDivElement>()
const currentPage = ref(0)
const fallbackMode = ref(false)
let pageFlip: PageFlip | null = null

const totalPages = computed(() => props.pages.length + 2) // cover + pages + back

const templateMap: Record<string, any> = {
  single: SingleTemplate,
  'double-h': DoubleHTemplate,
  'double-v': DoubleVTemplate,
  triple: TripleTemplate,
  'photo-text': PhotoTextTemplate,
}

function isPageVisible(index: number): boolean {
  return Math.abs(index - currentPage.value) <= 2
}

function getPageSize() {
  const isDouble = window.innerWidth >= 768
  const maxH = window.innerHeight * 0.85
  const maxW = isDouble ? window.innerWidth * 0.45 : window.innerWidth * 0.85
  const h = Math.min(maxH, maxW * (4 / 3))
  const w = h * (3 / 4)
  return { width: Math.floor(w), height: Math.floor(h) }
}

function playPageFlipSound() {
  audioManager.playSfx('page-flip')
}

function initPageFlip() {
  if (!bookRef.value) return
  try {
    const { width, height } = getPageSize()
    pageFlip = new PageFlip(bookRef.value, {
      width,
      height,
      size: 'stretch',
      showCover: true,
      maxShadowOpacity: 0.3,
      mobileScrollSupport: false,
    })

    const pageEls = bookRef.value.querySelectorAll('.page')
    if (pageEls.length > 0) {
      pageFlip.loadFromHTML(pageEls as unknown as HTMLElement[])
      pageFlip.on('flip', (e: any) => {
        currentPage.value = e.data
        playPageFlipSound()
      })
    }
  } catch (e) {
    console.warn('PageFlip init failed, using fallback mode:', e)
    fallbackMode.value = true
  }
}

function destroyPageFlip() {
  if (pageFlip) {
    pageFlip.destroy()
    pageFlip = null
  }
}

let resizeTimer: ReturnType<typeof setTimeout> | null = null
function handleResize() {
  if (fallbackMode.value) return
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    destroyPageFlip()
    nextTick(() => initPageFlip())
  }, 300)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  if (e.key === 'ArrowRight') pageFlip?.flipNext()
  if (e.key === 'ArrowLeft') pageFlip?.flipPrev()
}

onMounted(() => {
  nextTick(() => initPageFlip())
  window.addEventListener('resize', handleResize)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  destroyPageFlip()
  if (resizeTimer) clearTimeout(resizeTimer)
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="album-viewer" @click.self="emit('close')">
    <button class="album-close-btn" @click="emit('close')">✕</button>

    <!-- Fallback: 简单滚动列表 -->
    <div v-if="fallbackMode" class="album-fallback">
      <CoverPage :year="album.year" :title="album.title" :cover-url="album.coverUrl" />
      <div v-for="page in pages" :key="page.id" class="fallback-page">
        <component :is="templateMap[page.templateId]" :content="page.content" />
      </div>
    </div>

    <!-- Normal: PageFlip -->
    <div v-else ref="bookRef" class="album-book">
      <!-- Cover -->
      <div class="page page-cover" data-density="hard">
        <CoverPage :year="album.year" :title="album.title" :cover-url="album.coverUrl" />
      </div>
      <!-- Content Pages with lazy loading -->
      <div v-for="(page, idx) in pages" :key="page.id" class="page" :class="`template-${page.templateId}`">
        <component v-if="isPageVisible(idx + 1)" :is="templateMap[page.templateId]" :content="page.content" />
        <div v-else class="page-placeholder" />
      </div>
      <!-- Back Cover -->
      <div class="page page-back" data-density="hard">
        <BackCoverPage />
      </div>
    </div>
    <div class="page-indicator">{{ currentPage + 1 }} / {{ totalPages }}</div>
  </div>
</template>

<style scoped>
.album-viewer {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
}

.album-close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 101;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 20px;
  cursor: pointer;
  line-height: 40px;
  text-align: center;
}

.album-book {
  /* page-flip handles sizing */
}

.page {
  background: #fffdf8;
  overflow: hidden;
}

.page-cover, .page-back {
  background: none;
}

.page-indicator {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

.album-fallback {
  width: 90%;
  max-width: 600px;
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.fallback-page {
  background: #fffdf8;
  border-radius: 4px;
  aspect-ratio: 3/4;
}

.page-placeholder {
  width: 100%;
  height: 100%;
  background: #f5f0eb;
}
</style>
