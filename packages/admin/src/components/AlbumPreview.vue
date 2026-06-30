<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { PageFlip } from 'page-flip'
import { useThemeColor } from '@secret-space/shared'

const props = defineProps<{
  album: { year: number; title: string | null; coverUrl: string | null }
  pages: { id: string; templateId: string; content: { images: string[]; text?: string } }[]
}>()

const emit = defineEmits<{ close: [] }>()

const rootRef = ref<HTMLDivElement>()
const bookRef = ref<HTMLDivElement>()
let pageFlip: PageFlip | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null
const showHint = ref(true)
let hintTimer: ReturnType<typeof setTimeout> | null = null

const totalPages = computed(() => props.pages.length + 2)
const currentPage = ref(0)

// 预计算过滤后的图片数组，避免模板中每帧调用 .filter(Boolean)
const safePages = computed(() =>
  props.pages.map(p => ({
    ...p,
    safeImages: p.content.images.filter(Boolean),
  }))
)

// 主题色
const { extractFromImage, applyToElement } = useThemeColor()

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  } catch { return false }
}

function getPageSize() {
  const container = bookRef.value?.parentElement
  if (!container) return { width: 300, height: 400 }
  const containerRect = container.getBoundingClientRect()
  const footerH = 48 + 16
  const availableH = containerRect.height - footerH - 48
  const availableW = containerRect.width - 120
  const pageRatio = 3 / 4
  const bookH = Math.min(availableH, availableW / pageRatio)
  const bookW = Math.floor(bookH * pageRatio)
  return { width: bookW, height: Math.floor(bookH) }
}

function initPageFlip() {
  if (!bookRef.value) return
  const { width, height } = getPageSize()
  pageFlip = new PageFlip(bookRef.value, {
    width,
    height,
    size: 'stretch',
    showCover: true,
    maxShadowOpacity: 0.3,
    mobileScrollSupport: false,
    flippingTime: prefersReducedMotion() ? 1 : 800,
  })
  const els = bookRef.value.querySelectorAll('.page')
  if (els.length) {
    pageFlip.loadFromHTML(els as unknown as HTMLElement[])
    pageFlip.on('flip', (e: any) => {
      currentPage.value = e.data
      showHint.value = false
    })
  }
}

function destroyPageFlip() {
  if (pageFlip) {
    pageFlip.destroy()
    pageFlip = null
  }
}

function handleResize() {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    const saved = currentPage.value
    destroyPageFlip()
    nextTick(() => {
      initPageFlip()
      if (pageFlip && saved > 0) pageFlip.turnToPage(saved)
    })
  }, 300)
}

function flipPrev() { pageFlip?.flipPrev() }
function flipNext() { pageFlip?.flipNext() }

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') flipPrev()
  else if (e.key === 'ArrowRight') flipNext()
  else if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  applyToElement(rootRef.value!)
  if (props.album.coverUrl) extractFromImage(props.album.coverUrl)
  nextTick(initPageFlip)
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeydown)
  hintTimer = setTimeout(() => { showHint.value = false }, 3500)
})

onUnmounted(() => {
  destroyPageFlip()
  if (resizeTimer) clearTimeout(resizeTimer)
  if (hintTimer) clearTimeout(hintTimer)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div ref="rootRef" class="preview-overlay" @click.self="emit('close')">
    <button class="close-btn" @click="emit('close')" title="关闭 (Esc)" aria-label="关闭预览">✕</button>

    <div class="preview-container">
      <button
        class="nav-btn nav-prev"
        :disabled="currentPage === 0"
        @click="flipPrev"
        aria-label="上一页"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15,18 9,12 15,6"/></svg>
      </button>

      <div ref="bookRef" class="preview-book">
        <!-- 封面 -->
        <div class="page page-cover" data-density="hard">
          <div class="cover-page">
            <img v-if="album.coverUrl" :src="album.coverUrl" alt="封面" class="cover-img" />
            <div class="cover-info">
              <h1 class="cover-year">{{ album.year }}</h1>
              <p v-if="album.title" class="cover-title">{{ album.title }}</p>
            </div>
          </div>
        </div>

        <!-- 内容页 -->
        <div v-for="page in safePages" :key="page.id" class="page">
          <div :class="`tpl tpl-${page.templateId}`">
            <img v-for="(img, i) in page.safeImages" :key="i" :src="img" loading="lazy" alt="" />
            <p v-if="page.content.text" class="caption">{{ page.content.text }}</p>
          </div>
        </div>

        <!-- 封底 -->
        <div class="page page-back" data-density="hard">
          <div class="back-cover">
            <span class="back-cover-text">— 完 —</span>
          </div>
        </div>
      </div>

      <button
        class="nav-btn nav-next"
        :disabled="currentPage >= totalPages - 1"
        @click="flipNext"
        aria-label="下一页"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9,6 15,12 9,18"/></svg>
      </button>

      <Transition name="fade">
        <div v-if="showHint && currentPage === 0" class="flip-hint" aria-hidden="true">
          点击翻页或左右滑动
        </div>
      </Transition>
    </div>

    <div class="preview-controls">
      <span class="page-indicator">{{ currentPage + 1 }} / {{ totalPages }}</span>
      <span class="controls-keys"><kbd>←</kbd><kbd>→</kbd> 翻页 · <kbd>Esc</kbd> 关闭</span>
    </div>
  </div>
</template>

<style scoped>
.preview-overlay {
  --theme-from: #fef9f4;
  --theme-to: #fde8d0;
  --theme-text: #8b5e3c;
  --theme-sub: #a07050;

  position: fixed;
  inset: 0;
  z-index: 150;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

/* ===== 关闭按钮 ===== */
.close-btn {
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
.close-btn:hover { transform: scale(1.12); }
.close-btn:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

/* ===== 容器 ===== */
.preview-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex: 1;
  width: 100%;
  padding: 32px 24px;
  box-sizing: border-box;
  position: relative;
}

.preview-book {
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.15));
}

/* ===== 翻页按钮 ===== */
.nav-btn {
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
.nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}
.nav-btn:active:not(:disabled) { transform: scale(0.95); }
.nav-btn:disabled {
  opacity: 0.2;
  cursor: default;
}
.nav-btn:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

/* ===== 翻页提示 ===== */
.flip-hint {
  position: absolute;
  bottom: 12px;
  left: 50%;
  translate: -50% 0;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 13px;
  pointer-events: none;
  animation: hint-bounce 1.5s ease-in-out infinite;
}
@keyframes hint-bounce {
  0%, 100% { translate: -50% 0; }
  50% { translate: -50% -4px; }
}

/* ===== 底部控制栏 ===== */
.preview-controls {
  padding: 12px 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
  flex-shrink: 0;
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

/* ===== 过渡 ===== */
.fade-enter-active,
.fade-leave-active { transition: opacity 0.25s ease-out; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

/* ===== 可访问性：减少动画偏好 ===== */
@media (prefers-reduced-motion: reduce) {
  .flip-hint { animation: none; }
  .cover-page,
  .back-cover { transition: none; }
}
</style>
