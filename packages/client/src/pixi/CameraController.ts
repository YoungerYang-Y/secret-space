import gsap from 'gsap'
import { Container } from 'pixi.js'
import { ZONES } from './zones'

export interface CameraState {
  mode: 'overview' | 'zoomed'
  currentZoneId: string | null
  scale: number
  isTransitioning: boolean
}

export class CameraController {
  state: CameraState = { mode: 'overview', currentZoneId: null, scale: 1, isTransitioning: false }
  private viewport: { viewportWidth: number; viewportHeight: number }

  constructor(private world: Container, viewport: { viewportWidth: number; viewportHeight: number }) {
    this.viewport = viewport
  }

  async zoomIn(zoneId: string): Promise<void> {
    const zone = ZONES.find(z => z.id === zoneId)
    if (!zone) return
    this.state.isTransitioning = true
    const targetScale = 2.5
    const cx = zone.bounds.x + zone.bounds.w / 2
    const cy = zone.bounds.y + zone.bounds.h / 2
    const targetX = this.viewport.viewportWidth / 2 - cx * targetScale
    const targetY = this.viewport.viewportHeight / 2 - cy * targetScale
    await gsap.to(this.world, { x: targetX, y: targetY, duration: 0.6 })
    await gsap.to(this.world.scale, { x: targetScale, y: targetScale, duration: 0.6 })
    this.state = { mode: 'zoomed', currentZoneId: zoneId, scale: targetScale, isTransitioning: false }
  }

  async zoomOut(): Promise<void> {
    this.state.isTransitioning = true
    await gsap.to(this.world, { x: 0, y: 0, duration: 0.5 })
    await gsap.to(this.world.scale, { x: 1, y: 1, duration: 0.5 })
    this.state = { mode: 'overview', currentZoneId: null, scale: 1, isTransitioning: false }
  }

  swipeTo(direction: 'left' | 'right'): void {
    if (this.viewport.viewportWidth >= this.viewport.viewportHeight) return
    if (!this.state.currentZoneId) return
    const idx = ZONES.findIndex(z => z.id === this.state.currentZoneId)
    const next = direction === 'right' ? idx + 1 : idx - 1
    if (next < 0 || next >= ZONES.length) return
    this.state.currentZoneId = ZONES[next].id
  }

  updateViewport(viewport: { viewportWidth: number; viewportHeight: number }): void {
    this.viewport = viewport
  }
}
