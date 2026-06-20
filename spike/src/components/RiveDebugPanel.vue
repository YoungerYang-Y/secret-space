<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { bus, type RiveLoadedInfo, type RiveStateMachineInfo } from '../eventBus'

interface RiveEntry {
  label: string
  src: string
  artboard: string
  animations: string[]
  stateMachines: RiveStateMachineInfo[]
  error?: string | null
}

const riveEntries = ref<RiveEntry[]>([])
const selectedEntry = ref<RiveEntry | null>(null)

function onLoaded(data: RiveLoadedInfo) {
  const existing = riveEntries.value.find((e) => e.label === data.label)
  if (existing) {
    existing.artboard = data.artboard
    existing.animations = data.animations
    existing.stateMachines = data.stateMachines
    existing.error = null
  } else {
    riveEntries.value.push({ ...data, error: null })
  }
}

function onError(data: { label: string; src: string; error: string | null }) {
  const existing = riveEntries.value.find((e) => e.label === data.label)
  if (existing) {
    existing.error = data.error
  } else {
    riveEntries.value.push({ ...data, artboard: '?', animations: [], stateMachines: [], error: data.error })
  }
}

function onClick(data: { label: string; stateMachines: RiveStateMachineInfo[] }) {
  const entry = riveEntries.value.find((e) => e.label === data.label)
  if (entry) {
    entry.stateMachines = data.stateMachines
    selectedEntry.value = entry
  }
}

function sendInput(entry: RiveEntry, smName: string, inputName: string, type: string, value?: boolean | number) {
  if (type === 'Trigger') {
    bus.emit('rive:input', { label: entry.label, stateMachine: smName, input: inputName, trigger: true })
  } else {
    bus.emit('rive:input', { label: entry.label, stateMachine: smName, input: inputName, value })
  }
}

onMounted(() => {
  bus.on('rive:loaded', onLoaded)
  bus.on('rive:error', onError)
  bus.on('rive:click', onClick)
})

onUnmounted(() => {
  bus.off('rive:loaded', onLoaded)
  bus.off('rive:error', onError)
  bus.off('rive:click', onClick)
})
</script>

<template>
  <div class="rive-debug-panel">
    <div class="header">🎬 Rive 状态机调试</div>
    <div v-if="riveEntries.length === 0" class="empty">等待 .riv 文件加载...（检查控制台）</div>
    <div
      v-for="entry in riveEntries"
      :key="entry.label"
      class="entry"
      :class="{ error: entry.error, selected: selectedEntry === entry }"
      @click="selectedEntry = entry"
    >
      <div class="entry-header">
        <span class="label">{{ entry.label }}</span>
        <span class="status">
          {{ entry.error ? '❌' : entry.stateMachines.length > 0 || entry.animations.length > 0 ? '✅' : '⏳' }}
        </span>
      </div>
      <div class="src">{{ entry.src }}</div>

      <!-- Animations (timeline, no state machine) -->
      <div v-if="entry.animations.length > 0" class="anim-list">
        <span class="anim-tag" v-for="a in entry.animations" :key="a">🎞️ {{ a }}</span>
      </div>

      <!-- Error -->
      <div v-if="entry.error" class="error-msg">{{ entry.error }}</div>
    </div>

    <!-- expanded state machine view -->
    <div
      v-if="selectedEntry && !selectedEntry.error && selectedEntry.stateMachines.length > 0"
      class="sm-detail"
    >
      <div class="sm-title">状态机: {{ selectedEntry.label }}</div>
      <div v-for="sm in selectedEntry.stateMachines" :key="sm.name" class="sm-group">
        <div class="sm-name">📂 {{ sm.name }}</div>
        <div v-for="input in sm.inputs" :key="input.name" class="input-row">
          <span class="input-name">{{ input.name }}</span>
          <span class="input-type" :class="input.type.toLowerCase()">{{ input.type }}</span>
          <template v-if="input.type === 'Boolean'">
            <button
              class="btn sm"
              :class="{ active: input.value }"
              @click.stop="sendInput(selectedEntry!, sm.name, input.name, 'Boolean', !input.value)"
            >
              {{ input.value ? '✓ true' : '✗ false' }}
            </button>
          </template>
          <template v-else-if="input.type === 'Number'">
            <input
              type="range"
              min="0"
              max="100"
              :value="(input.value as number) ?? 0"
              class="slider"
              @input.stop="
                sendInput(selectedEntry!, sm.name, input.name, 'Number', Number(($event.target as HTMLInputElement).value))
              "
            />
            <span class="val">{{ input.value }}</span>
          </template>
          <template v-else-if="input.type === 'Trigger'">
            <button class="btn sm trigger" @click.stop="sendInput(selectedEntry!, sm.name, input.name, 'Trigger')">
              🔥 Fire
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Animations only (no state machines) -->
    <div
      v-if="selectedEntry && !selectedEntry.error && selectedEntry.stateMachines.length === 0 && selectedEntry.animations.length > 0"
      class="sm-detail"
    >
      <div class="sm-title">时间线动画 (无状态机):</div>
      <div class="anim-list-detail">
        <span class="anim-tag" v-for="a in selectedEntry.animations" :key="a">🎞️ {{ a }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rive-debug-panel {
  position: fixed;
  bottom: 12px;
  left: 12px;
  z-index: 200;
  background: rgba(30, 30, 40, 0.92);
  color: #e0e0e0;
  border-radius: 12px;
  padding: 12px;
  max-width: 340px;
  max-height: 50vh;
  overflow-y: auto;
  font-size: 12px;
  font-family: monospace;
}
.header {
  font-size: 14px;
  font-weight: bold;
  color: #ffab40;
  margin-bottom: 8px;
}
.empty { color: #888; font-style: italic; }
.entry {
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
  background: rgba(255, 255, 255, 0.05);
}
.entry:hover { background: rgba(255, 255, 255, 0.12); }
.entry.selected { border: 1px solid #ffab40; background: rgba(255, 171, 64, 0.1); }
.entry-header { display: flex; justify-content: space-between; }
.label { font-weight: bold; color: #64b5f6; }
.src { color: #888; font-size: 10px; }
.error-msg { color: #ef5350; font-size: 10px; }
.status { font-size: 11px; }

.anim-list { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 3px; }
.anim-tag {
  font-size: 9px;
  background: rgba(255, 171, 64, 0.2);
  color: #ffab40;
  padding: 1px 5px;
  border-radius: 3px;
}

.sm-detail {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.sm-title { color: #ffab40; margin-bottom: 4px; }
.sm-group { margin-bottom: 6px; }
.sm-name { color: #a5d6a7; margin-bottom: 2px; }
.input-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0 2px 12px;
}
.input-name { color: #ce93d8; min-width: 60px; }
.input-type {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
}
.input-type.boolean { color: #fff176; }
.input-type.number { color: #81d4fa; }
.input-type.trigger { color: #ef9a9a; }
.btn.sm {
  border: none;
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 10px;
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}
.btn.sm.active { background: #43a047; }
.btn.sm.trigger { background: #e53935; }
.slider { width: 50px; }
.val { color: #aaa; font-size: 10px; }

.anim-list-detail { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; }
</style>
