<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import draggable from 'vuedraggable'
import { ElMessage } from 'element-plus'
import { compressImage } from '../utils/compress'
import { useAdminAuthStore } from '../stores/auth'
import AlbumPreview from '../components/AlbumPreview.vue'

const route = useRoute()
const authStore = useAdminAuthStore()
const albumId = computed(() => route.params.id as string)

interface Page {
  id: string
  order: number
  templateId: string
  content: { images: string[]; text?: string }
}

const TEMPLATES = [
  { id: 'single', label: '单图', slots: 1 },
  { id: 'double-h', label: '左右双图', slots: 2 },
  { id: 'double-v', label: '上下双图', slots: 2 },
  { id: 'triple', label: '三宫格', slots: 3 },
  { id: 'photo-text', label: '图+文字', slots: 1 },
]

const pages = ref<Page[]>([])
const selectedPage = ref<Page | null>(null)
const addDialogVisible = ref(false)
const newTemplateId = ref('single')
const showPreview = ref(false)
const albumInfo = ref<{ year: number; title: string | null; coverUrl: string | null }>({ year: 2024, title: null, coverUrl: null })

function getHeaders() {
  return { Authorization: `Bearer ${authStore.token}` }
}

async function fetchPages() {
  const res = await axios.get(`/albums/${albumId.value}/pages`)
  pages.value = res.data.map((p: any) => ({
    ...p,
    content: typeof p.content === 'string' ? JSON.parse(p.content) : p.content,
  }))
  if (pages.value.length && !selectedPage.value) {
    selectedPage.value = pages.value[0]
  }
}

async function fetchAlbumInfo() {
  const res = await axios.get('/albums')
  const album = res.data.find((a: any) => a.id === albumId.value)
  if (album) albumInfo.value = { year: album.year, title: album.title, coverUrl: album.coverUrl }
}

async function handleDragEnd() {
  const pageIds = pages.value.map((p) => p.id)
  try {
    await axios.put(`/albums/${albumId.value}/pages/reorder`, { pageIds }, { headers: getHeaders() })
  } catch {
    ElMessage.error('排序保存失败')
  }
}

async function addPage() {
  const tpl = TEMPLATES.find((t) => t.id === newTemplateId.value)!
  const content = { images: Array(tpl.slots).fill(''), text: '' }
  try {
    await axios.post(`/albums/${albumId.value}/pages`, {
      templateId: newTemplateId.value,
      content,
      order: pages.value.length + 1,
    }, { headers: getHeaders() })
    addDialogVisible.value = false
    await fetchPages()
    selectedPage.value = pages.value[pages.value.length - 1]
    ElMessage.success('页面已添加')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '添加失败')
  }
}

async function savePage() {
  if (!selectedPage.value) return
  try {
    await axios.put(`/pages/${selectedPage.value.id}`, {
      templateId: selectedPage.value.templateId,
      content: selectedPage.value.content,
    }, { headers: getHeaders() })
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  }
}

async function deletePage(page: Page) {
  try {
    await axios.delete(`/pages/${page.id}`, { headers: getHeaders() })
    if (selectedPage.value?.id === page.id) selectedPage.value = null
    await fetchPages()
    ElMessage.success('已删除')
  } catch {
    ElMessage.error('删除失败')
  }
}

async function uploadImage(file: File, index: number) {
  if (!selectedPage.value) return
  try {
    const compressed = await compressImage(file)
    const ext = '.webp'
    const presignRes = await axios.post('/photos/presign', {
      provinceCode: 'album',
      filename: `page-${Date.now()}${ext}`,
      contentType: 'image/webp',
    }, { headers: getHeaders() })
    const { uploadUrl, key } = presignRes.data
    await fetch(uploadUrl, { method: 'PUT', body: compressed, headers: { 'Content-Type': 'image/webp' } })
    selectedPage.value.content.images[index] = presignRes.data.publicUrl
    await savePage()
  } catch {
    ElMessage.error('上传失败')
  }
}

function getSlotCount(templateId: string) {
  return TEMPLATES.find((t) => t.id === templateId)?.slots || 1
}

watch(() => selectedPage.value?.templateId, (newId, oldId) => {
  if (!selectedPage.value || !newId || !oldId) return
  const slots = getSlotCount(newId)
  selectedPage.value.content.images = selectedPage.value.content.images.slice(0, slots)
  while (selectedPage.value.content.images.length < slots) {
    selectedPage.value.content.images.push('')
  }
  // 仅在有实际图片内容时自动保存，避免空数组写入
  if (selectedPage.value.content.images.some(Boolean)) savePage()
})

onMounted(() => { fetchPages(); fetchAlbumInfo() })
</script>

<template>
  <div class="page-editor">
    <div class="page-editor-left">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0">页面列表</h3>
        <div>
          <el-button size="small" @click="showPreview = true">预览</el-button>
          <el-button size="small" type="primary" @click="addDialogVisible = true">+ 添加</el-button>
        </div>
      </div>
      <draggable v-model="pages" item-key="id" @end="handleDragEnd">
        <template #item="{ element }">
          <div
            class="page-card"
            :class="{ active: selectedPage?.id === element.id }"
            @click="selectedPage = element"
          >
            <span>{{ element.order }}. {{ TEMPLATES.find(t => t.id === element.templateId)?.label }}</span>
            <el-button size="small" type="danger" text @click.stop="deletePage(element)">×</el-button>
          </div>
        </template>
      </draggable>
    </div>

    <div class="page-editor-right">
      <template v-if="selectedPage">
        <h3>模板：{{ TEMPLATES.find(t => t.id === selectedPage!.templateId)?.label }}</h3>
        <el-radio-group v-model="selectedPage.templateId" style="margin-bottom:16px">
          <el-radio-button v-for="tpl in TEMPLATES" :key="tpl.id" :value="tpl.id">{{ tpl.label }}</el-radio-button>
        </el-radio-group>

        <div class="image-slots">
          <div v-for="i in getSlotCount(selectedPage.templateId)" :key="i" class="image-slot">
            <el-image
              v-if="selectedPage.content.images[i-1]"
              :src="selectedPage.content.images[i-1]"
              style="width:120px;height:90px"
              fit="cover"
            />
            <el-upload
              :show-file-list="false"
              :before-upload="(file: any) => { uploadImage(file, i-1); return false }"
              accept="image/*"
            >
              <el-button size="small">{{ selectedPage.content.images[i-1] ? '替换' : '上传' }} 图{{ i }}</el-button>
            </el-upload>
          </div>
        </div>

        <el-input
          v-if="selectedPage.templateId === 'photo-text'"
          v-model="selectedPage.content.text"
          type="textarea"
          placeholder="文字说明"
          style="margin-top:12px"
        />

        <el-button type="primary" style="margin-top:16px" @click="savePage">保存页面</el-button>
      </template>
      <div v-else class="empty-hint">← 选择一个页面进行编辑</div>
    </div>

    <el-dialog v-model="addDialogVisible" title="添加页面" width="360px">
      <el-radio-group v-model="newTemplateId">
        <el-radio v-for="tpl in TEMPLATES" :key="tpl.id" :value="tpl.id">{{ tpl.label }}</el-radio>
      </el-radio-group>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="addPage">确定</el-button>
      </template>
    </el-dialog>

    <AlbumPreview
      v-if="showPreview"
      :album="albumInfo"
      :pages="pages"
      @close="showPreview = false"
    />
  </div>
</template>

<style scoped>
.page-editor {
  display: flex;
  gap: 24px;
  height: calc(100vh - 100px);
}
.page-editor-left {
  width: 240px;
  flex-shrink: 0;
  overflow-y: auto;
}
.page-editor-right {
  flex: 1;
  overflow-y: auto;
}
.page-card {
  padding: 8px 12px;
  margin-bottom: 4px;
  border: 1px solid #eee;
  border-radius: 4px;
  cursor: grab;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.page-card.active {
  border-color: #409eff;
  background: #ecf5ff;
}
.image-slots {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.image-slot {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}
.empty-hint {
  color: #999;
  padding-top: 40px;
  text-align: center;
}
</style>
