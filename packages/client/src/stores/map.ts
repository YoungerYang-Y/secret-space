import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface ProvinceDto {
  code: string
  name: string
  visited: boolean
  photoCount: number
}

export const useMapStore = defineStore('map', () => {
  const provinces = ref<ProvinceDto[]>([])
  const loading = ref(false)

  const visitedCount = computed(() => provinces.value.filter((p) => p.visited).length)

  async function fetchProvinces() {
    loading.value = true
    try {
      const res = await fetch('/provinces')
      provinces.value = await res.json()
    } finally {
      loading.value = false
    }
  }

  return { provinces, loading, visitedCount, fetchProvinces }
})
