import { createApp } from 'vue'
import { RuntimeLoader } from '@rive-app/canvas'
// Use local WASM instead of unpkg CDN (avoids network issues)
import riveWasmUrl from '@rive-app/canvas/rive.wasm?url'
import App from './App.vue'

RuntimeLoader.setWasmUrl(riveWasmUrl)

createApp(App).mount('#app')
