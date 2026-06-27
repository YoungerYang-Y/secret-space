import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch } from '../utils/apiFetch'

export interface AlbumDto {
  id: string
  year: number
  title: string | null
  coverUrl: string | null
  createdAt: string
}

export interface PageDto {
  id: string
  albumId: string
  order: number
  templateId: string
  content: { images: string[]; text?: string }
  createdAt: string
}

const PALETTE = [
  '#E8A87C', '#85CDCA', '#D4A5A5', '#9EC1CF',
  '#C9B1FF', '#F7DC6F', '#A3D9A5', '#F0B27A',
]

export const useAlbumStore = defineStore('album', () => {
  const albums = ref<AlbumDto[]>([])
  const currentPages = ref<PageDto[]>([])
  const loading = ref(false)

  function getSpineColor(year: number): string {
    return PALETTE[year % PALETTE.length]
  }

  async function fetchAlbums() {
    loading.value = true
    try {
      const res = await apiFetch('/api/albums')
      if (!res.ok) throw new Error('获取相册列表失败')
      albums.value = await res.json()
    } finally {
      loading.value = false
    }
  }

  async function fetchPages(albumId: string) {
    const res = await apiFetch(`/api/albums/${albumId}/pages`)
    if (!res.ok) throw new Error('获取页面列表失败')
    const raw = await res.json()
    currentPages.value = raw.map((p: any) => ({
      ...p,
      content: typeof p.content === 'string' ? JSON.parse(p.content) : p.content,
    }))
  }

  return { albums, currentPages, loading, getSpineColor, fetchAlbums, fetchPages }
})
