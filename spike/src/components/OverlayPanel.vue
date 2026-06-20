<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { bus } from '../eventBus'

const visible = ref(false)
const hotspot = ref({ id: '', label: '', x: 0, y: 0 })

function onHotspotClick(data: { id: string; label: string; x: number; y: number }) {
  hotspot.value = data
  visible.value = true
}

function close() {
  visible.value = false
  bus.emit('panel:close')
}

onMounted(() => { bus.on('hotspot:click', onHotspotClick) })
onUnmounted(() => { bus.off('hotspot:click', onHotspotClick) })
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="overlay" @click.self="close">
      <div class="panel">
        <h2>{{ hotspot.label }}</h2>
        <p>热区 ID: {{ hotspot.id }}</p>
        <p>坐标: ({{ hotspot.x }}, {{ hotspot.y }})</p>
        <p class="hint">✅ Spike 2 验证：PixiJS 点击 → Vue 面板弹出成功</p>
        <button @click="close">关闭面板（通知 PixiJS zoom-out）</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.panel {
  background: #fff; border-radius: 16px; padding: 32px;
  max-width: 360px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15); text-align: center;
}
.panel h2 { margin: 0 0 12px; color: #e91e63; }
.panel p { margin: 8px 0; color: #555; }
.hint { color: #4caf50; font-weight: bold; }
button {
  margin-top: 16px; padding: 10px 24px; border: none; border-radius: 8px;
  background: #e91e63; color: #fff; font-size: 14px; cursor: pointer;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
