import mitt from 'mitt'

export interface RiveStateMachineInfo {
  name: string
  inputs: Array<{ name: string; type: string; value?: boolean | number }>
}

export interface RiveLoadedInfo {
  label: string
  src: string
  artboard: string
  animations: string[]
  stateMachines: RiveStateMachineInfo[]
}

export type Events = {
  // PixiJS → Vue
  'hotspot:click': { id: string; label: string; x: number; y: number }
  // Vue → PixiJS
  'panel:close': void
  // Camera
  'camera:zoomIn': { zoneIndex: number }
  'camera:zoomOut': void
  // Rive
  'rive:loaded': RiveLoadedInfo
  'rive:error': { label: string; src: string; error: string | null }
  'rive:click': { label: string; stateMachines: RiveStateMachineInfo[] }
  'rive:input': { label: string; stateMachine: string; input: string; value?: boolean | number; trigger?: boolean }
}

export const bus = mitt<Events>()
