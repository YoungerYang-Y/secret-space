<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { PageFlip } from 'page-flip'

const props = defineProps<{
  album: { year: number; title: string | null; coverUrl: string | null }
  pages: { id: string; templateId: string; content: { images: string[]; text?: string } }[]
}>()

const emit = defineEmits<{ close: [] }>()

const bookRef = ref<HTMLDivElement>()
let pageFlip: PageFlip | null = null

const totalPages = computed(() => props.pages.length + 2)
const currentPage = ref(0)

function initPageFlip() {
  if (!bookRef.value) return
  const h = Math.min(window.innerHeight * 0.7, 500)
  const w = h * (3 / 4)
  pageFlip = new PageFlip(bookRef.value, {
    width: Math.floor(w),
    height: Math.floor(h),
    size: 'stretch',
    showCover: true,
    maxShadowOpacity: 0.3,
  })
  const els = bookRef.value.querySelectorAll('.page')
  if (els.length) {
    pageFlip.loadFromHTML(els as unknown as HTMLElement[])
    pageFlip.on('flip', (e: any) => { currentPage.value = e.data })
  }
}

onMounted(() => nextTick(initPageFlip))
onUnmounted(() => { pageFlip?.destroy() })
</script>

<template>
  <div class="preview-overlay" @click.self="emit('close')">
    <div class="preview-container">
      <div ref="bookRef" class="preview-book">
        <div class="page" data-density="hard">
          <div class="cover-page">
            <img v-if="album.coverUrl" :src="album.coverUrl" class="cover-img" />
            <h2>{{ album.year }}</h2>
            <p v-if="album.title">{{ album.title }}</p>
          </div>
        </div>
        <div v-for="page in pages" :key="page.id" class="page">
          <div :class="`tpl-${page.templateId}`">
            <img v-for="(img, i) in page.content.images.filter(Boolean)" :key="i" :src="img" />
            <p v-if="page.content.text">{{ page.content.text }}</p>
          </div>
        </div>
        <div class="page" data-density="hard">
          <div class="back-page">— 完 —</div>
        </div>
      </div>
      <div class="preview-footer">
        <span>{{ currentPage + 1 }} / {{ totalPages }}</span>
        <el-button size="small" @click="emit('close')">关闭</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-container {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  max-width: 90vw;
}
.page {
  background: #fffdf8;
  overflow: hidden;
}
.cover-page, .back-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #fef9f4, #fde8d0);
}
.cover-img { max-width: 60%; max-height: 50%; object-fit: cover; border-radius: 8px; }
.tpl-single, .tpl-double-h, .tpl-double-v, .tpl-triple, .tpl-photo-text {
  width: 100%; height: 100%; display: flex; padding: 12px; box-sizing: border-box; gap: 6px;
}
.tpl-single { align-items: center; justify-content: center; }
.tpl-single img { max-width: 100%; max-height: 100%; object-fit: contain; }
.tpl-double-h { flex-direction: row; }
.tpl-double-h img { flex: 1; object-fit: cover; min-width: 0; }
.tpl-double-v { flex-direction: column; }
.tpl-double-v img { flex: 1; object-fit: cover; min-height: 0; }
.tpl-triple { flex-wrap: wrap; }
.tpl-triple img { width: 48%; object-fit: cover; }
.tpl-photo-text { flex-direction: column; align-items: center; }
.tpl-photo-text img { flex: 1; max-width: 100%; object-fit: contain; min-height: 0; }
.tpl-photo-text p { font-size: 12px; color: #666; margin: 4px 0 0; }
.preview-footer { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; }
</style>
