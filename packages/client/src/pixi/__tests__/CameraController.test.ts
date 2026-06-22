import { describe, it, expect, vi } from 'vitest'
import { CameraController } from '../CameraController'
import { Container } from 'pixi.js'

vi.mock('gsap', () => ({
  default: { to: vi.fn((_target, opts) => { Object.assign(_target, opts); return { then: (cb: any) => cb?.() } }) },
  gsap: { to: vi.fn((_target, opts) => { Object.assign(_target, opts); return { then: (cb: any) => cb?.() } }) },
}))

vi.mock('pixi.js', () => ({
  Container: vi.fn().mockImplementation(() => ({
    scale: { x: 1, y: 1, set: vi.fn(function(v: number) { this.x = v; this.y = v }) },
    x: 0, y: 0,
  })),
}))

describe('CameraController', () => {
  it('zoomIn sets state to zoomed with correct scale', async () => {
    const world = new Container()
    const cc = new CameraController(world, { viewportWidth: 960, viewportHeight: 540 })
    await cc.zoomIn('desk')
    expect(cc.state.mode).toBe('zoomed')
    expect(cc.state.currentZoneId).toBe('desk')
    expect(cc.state.scale).toBe(2.5)
  })

  it('zoomOut restores overview state', async () => {
    const world = new Container()
    const cc = new CameraController(world, { viewportWidth: 960, viewportHeight: 540 })
    await cc.zoomIn('desk')
    await cc.zoomOut()
    expect(cc.state.mode).toBe('overview')
    expect(cc.state.currentZoneId).toBeNull()
    expect(cc.state.scale).toBe(1)
  })

  it('swipeTo changes zone in portrait mode', async () => {
    const world = new Container()
    const cc = new CameraController(world, { viewportWidth: 540, viewportHeight: 960 })
    await cc.zoomIn('wall')
    cc.swipeTo('right')
    expect(cc.state.currentZoneId).toBe('shelf')
  })

  it('orientation change preserves zoom state', async () => {
    const world = new Container()
    const cc = new CameraController(world, { viewportWidth: 960, viewportHeight: 540 })
    await cc.zoomIn('desk')
    cc.updateViewport({ viewportWidth: 540, viewportHeight: 960 })
    expect(cc.state.mode).toBe('zoomed')
    expect(cc.state.currentZoneId).toBe('desk')
  })
})
