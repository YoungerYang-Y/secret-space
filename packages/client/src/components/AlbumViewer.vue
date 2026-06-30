<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, type Component } from 'vue'
import { PageFlip } from 'page-flip'
import { useThemeColor } from '@secret-space/shared'
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

const rootRef = ref<HTMLDivElement>()
const bookRef = ref<HTMLDivElement>()
const currentPage = ref(0)
const fallbackMode = ref(false)
const showHint = ref(true)
let hintTimer: ReturnType<typeof setTimeout> | null = null
let pageFlip: PageFlip | null = null

const totalPages = computed(() => props.pages.length + 2) // cover + pages + back

const templateMap: Record<string, Component> = {
  single: SingleTemplate,
  'double-h': DoubleHTemplate,
  'double-v': DoubleVTemplate,
  triple: TripleTemplate,
  'photo-text': PhotoTextTemplate,
}

// 主题色
const { extractFromImage, applyToElement } = useThemeColor()

function isPageVisible(index: number): boolean {
  return Math.abs(index - currentPage.value) <= 3
}

function getPageSize() {
  const isDouble = window.innerWidth >= 768
  // 留出上下各 48px 边距（底部控制栏 + 顶部关闭按钮）
  const maxH = window.innerHeight - 96
  const maxW = isDouble ? window.innerWidth * 0.45 : window.innerWidth * 0.85
  const h = Math.min(maxH, maxW * (4 / 3))
  const w = h * (3 / 4)
  return { width: Math.floor(w), height: Math.floor(h) }
}

function playPageFlipSound() {
  audioManager.playSfx('page-flip')
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  } catch { return false }
}

function initPageFlip() {
  if (!bookRef.value) return
  try {
    const { width, height } = getPageSize()
    pageFlip = new PageFlip(bookRef.value, {
      width,
      height,
      size: 'stretch',
      minWidth: Math.floor(width * 0.3),
      maxWidth: width,
      minHeight: Math.floor(height * 0.3),
      maxHeight: height,
      showCover: true,
      drawShadow: true,
      maxShadowOpacity: 0.8,
      showPageCorners: true,
      mobileScrollSupport: false,
      flippingTime: prefersReducedMotion() ? 1 : 1000,
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

function flipPrev() { pageFlip?.flipPrev() }
function flipNext() { pageFlip?.flipNext() }

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  if (e.key === 'ArrowRight') flipNext()
  if (e.key === 'ArrowLeft') flipPrev()
}

onMounted(() => {
  applyToElement(rootRef.value!)
  if (props.album.coverUrl) extractFromImage(props.album.coverUrl)
  nextTick(() => initPageFlip())
  document.addEventListener('keydown', handleKeydown)
  hintTimer = setTimeout(() => { showHint.value = false }, 4000)
})

onUnmounted(() => {
  destroyPageFlip()
  if (hintTimer) clearTimeout(hintTimer)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div ref="rootRef" class="album-viewer" @click.self="emit('close')">
    <button class="album-close-btn" @click="emit('close')" title="关闭 (Esc)" aria-label="关闭相册">✕</button>

    <!-- Fallback: 简单滚动列表 -->
    <div v-if="fallbackMode" class="album-fallback">
      <CoverPage :year="album.year" :title="album.title" :cover-url="album.coverUrl" />
      <div v-for="page in pages" :key="page.id" class="fallback-page">
        <component :is="templateMap[page.templateId]" :content="page.content" />
      </div>
    </div>

    <!-- Normal: PageFlip -->
    <div v-else class="album-viewer-body">
      <button
        class="album-nav-btn album-nav-prev"
        :disabled="currentPage === 0"
        @click="flipPrev"
        aria-label="上一页"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15,18 9,12 15,6"/></svg>
      </button>

      <div ref="bookRef" class="album-book">
        <!-- Cover -->
        <div class="page page-cover">
          <CoverPage :year="album.year" :title="album.title" :cover-url="album.coverUrl" />
        </div>
        <!-- Content Pages with lazy loading -->
        <div v-for="(page, idx) in pages" :key="page.id" class="page" :class="`template-${page.templateId}`">
          <component v-if="isPageVisible(idx + 1)" :is="templateMap[page.templateId]" :content="page.content" />
          <div v-else class="page-placeholder" />
        </div>
        <!-- Back Cover -->
        <div class="page page-back">
          <BackCoverPage />
        </div>
      </div>

      <button
        class="album-nav-btn album-nav-next"
        :disabled="currentPage >= totalPages - 1"
        @click="flipNext"
        aria-label="下一页"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9,6 15,12 9,18"/></svg>
      </button>
    </div>

    <Transition name="fade">
      <div v-if="showHint && currentPage === 0 && !fallbackMode" class="flip-hint" aria-hidden="true">
        点击翻页或左右滑动
      </div>
    </Transition>

    <div class="album-controls">
      <span class="page-indicator">{{ currentPage + 1 }} / {{ totalPages }}</span>
      <span v-if="!fallbackMode" class="controls-keys"><kbd>←</kbd><kbd>→</kbd> 翻页 · <kbd>Esc</kbd> 关闭</span>
    </div>
  </div>
</template>

<style scoped>
.album-viewer {
  --theme-from: #fef9f4;
  --theme-to: #fde8d0;
  --theme-text: #8b5e3c;
  --theme-sub: #a07050;

  position: fixed;
  inset: 0;
  z-index: 150;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  box-sizing: border-box;
}

.album-close-btn {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 160;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  font-size: 20px;
  cursor: pointer;
  line-height: 44px;
  text-align: center;
  transition: transform 0.15s ease-out;
}
.album-close-btn:hover { transform: scale(1.12); }
.album-close-btn:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.album-viewer-body {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
}

.album-book {
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.15));
}

/* ===== 翻页按钮 ===== */
.album-nav-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease-out, transform 0.15s ease-out, opacity 0.15s ease-out;
  flex-shrink: 0;
}
.album-nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}
.album-nav-btn:active:not(:disabled) { transform: scale(0.95); }
.album-nav-btn:disabled {
  opacity: 0.2;
  cursor: default;
}
.album-nav-btn:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.page {
  background: #fffdf8;
  overflow: hidden;
}

.page-cover,
.page-back {
  background: none;
}

.page-placeholder {
  width: 100%;
  height: 100%;
  background: #f5f0eb;
}

/* ===== 翻页提示 ===== */
.flip-hint {
  position: fixed;
  bottom: 60px;
  left: 50%;
  translate: -50% 0;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 13px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 155;
  animation: hint-bounce 1.5s ease-in-out infinite;
}
@keyframes hint-bounce {
  0%, 100% { translate: -50% 0; }
  50% { translate: -50% -4px; }
}

/* ===== 底部控制栏 ===== */
.album-controls {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 24px;
  z-index: 155;
}
.page-indicator {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}
.controls-keys {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}
.controls-keys kbd {
  padding: 1px 5px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 3px;
  font-size: 11px;
  font-family: inherit;
}

/* ===== Fallback 模式 ===== */
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

/* ===== 过渡 ===== */
.fade-enter-active,
.fade-leave-active { transition: opacity 0.25s ease-out; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

/* ===== 可访问性：减少动画偏好 ===== */
@media (prefers-reduced-motion: reduce) {
  .flip-hint { animation: none; }
}
</style>
