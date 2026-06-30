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
const showHint = ref(true)
let hintTimer: ReturnType<typeof setTimeout> | null = null

const totalPages = computed(() => props.pages.length + 2)
const currentPage = ref(0)

// 预计算过滤后的图片数组
const safePages = computed(() =>
  props.pages.map(p => ({
    ...p,
    safeImages: p.content.images.filter(Boolean),
  }))
)

// 懒加载：仅渲染当前页 ±3 范围内的内容
function isPageVisible(index: number): boolean {
  return Math.abs(index - currentPage.value) <= 3
}

// 主题色
const { extractFromImage, applyToElement } = useThemeColor()

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  } catch { return false }
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

function initPageFlip() {
  if (!bookRef.value) return
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
  document.addEventListener('keydown', handleKeydown)
  hintTimer = setTimeout(() => { showHint.value = false }, 3500)
})

onUnmounted(() => {
  destroyPageFlip()
  if (hintTimer) clearTimeout(hintTimer)
  document.removeEventListener('keydown', handleKeydown)
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
        <div class="page page-cover">
          <div class="cover-page">
            <img v-if="album.coverUrl" :src="album.coverUrl" alt="封面" class="cover-img" />
            <div class="cover-info">
              <h1 class="cover-year">{{ album.year }}</h1>
              <p v-if="album.title" class="cover-title">{{ album.title }}</p>
            </div>
          </div>
        </div>

        <!-- 内容页（懒加载） -->
        <div v-for="(page, idx) in safePages" :key="page.id" class="page">
          <div v-if="isPageVisible(idx + 1)" :class="`tpl tpl-${page.templateId}`">
            <img v-for="(img, i) in page.safeImages" :key="i" :src="img" loading="lazy" alt="" />
            <p v-if="page.content.text" class="caption">{{ page.content.text }}</p>
          </div>
          <div v-else class="page-placeholder" />
        </div>

        <!-- 封底 -->
        <div class="page page-back">
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
    </div>

    <Transition name="fade">
      <div v-if="showHint && currentPage === 0" class="flip-hint" aria-hidden="true">
        点击翻页或左右滑动
      </div>
    </Transition>

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
  padding: 32px 24px;
  box-sizing: border-box;
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
  width: 100%;
  box-sizing: border-box;
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

/* ===== 页面通用 ===== */
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

/* ===== 封面（与 client CoverPage 一致） ===== */
.cover-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--theme-from, #fef9f4), var(--theme-to, #fde8d0));
  padding: 24px;
  box-sizing: border-box;
  transition: background 0.6s;
}
.cover-img {
  max-width: 70%;
  max-height: 60%;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
.cover-info {
  margin-top: 16px;
  text-align: center;
}
.cover-year {
  font-size: 32px;
  font-weight: 700;
  color: var(--theme-text, #8b5e3c);
  margin: 0;
}
.cover-title {
  font-size: 16px;
  color: var(--theme-sub, #a07050);
  margin: 8px 0 0;
}

/* ===== 封底（与 client BackCoverPage 一致） ===== */
.back-cover {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--theme-from, #fef9f4), var(--theme-to, #fde8d0));
  transition: background 0.6s;
}
.back-cover-text {
  font-size: 18px;
  color: var(--theme-sub, #a07050);
}

/* ===== 模板布局（与 client templates 一致） ===== */
.tpl {
  width: 100%;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
}
.tpl img {
  border-radius: 4px;
}

.tpl-single {
  display: flex;
  align-items: center;
  justify-content: center;
}
.tpl-single img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.tpl-double-h {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-items: center;
}
.tpl-double-h img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tpl-double-v {
  display: grid;
  grid-template-rows: 1fr 1fr;
  gap: 8px;
}
.tpl-double-v img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tpl-triple {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 8px;
}
.tpl-triple img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tpl-triple img:first-child {
  grid-row: 1 / -1;
}

.tpl-photo-text {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tpl-photo-text img {
  flex: 1;
  width: 100%;
  object-fit: contain;
  min-height: 0;
}
.caption {
  text-align: center;
  font-size: 14px;
  color: #555;
  margin: 0;
  line-height: 1.5;
}

/* ===== 翻页提示（fixed 定位，与 client 一致） ===== */
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

/* ===== 底部控制栏（fixed 定位，与 client 一致） ===== */
.preview-controls {
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
