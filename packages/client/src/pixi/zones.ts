export interface ZoneDefinition {
  id: string
  label: string
  bounds: { x: number; y: number; w: number; h: number }
}

export const ZONES: ZoneDefinition[] = [
  { id: 'wall', label: '墙面区', bounds: { x: 0, y: 0, w: 480, h: 300 } },
  { id: 'shelf', label: '书架区', bounds: { x: 480, y: 0, w: 240, h: 350 } },
  { id: 'desk', label: '书桌区', bounds: { x: 480, y: 200, w: 250, h: 340 } },
  { id: 'window', label: '窗户区', bounds: { x: 720, y: 0, w: 240, h: 350 } },
  { id: 'game', label: '游戏区', bounds: { x: 0, y: 300, w: 400, h: 240 } },
]
