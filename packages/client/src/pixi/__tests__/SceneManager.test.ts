import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SceneManager } from '../SceneManager'

vi.mock('pixi.js', () => {
  const Container = vi.fn().mockImplementation(() => ({
    scale: { x: 1, y: 1, set: vi.fn(function (v: number) { this.x = v; this.y = v }) },
    x: 0,
    y: 0,
    addChild: vi.fn(),
  }))
  const Application = vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    stage: { addChild: vi.fn() },
    canvas: null,
    destroy: vi.fn(),
  }))
  return { Application, Container, Sprite: vi.fn(), Assets: { load: vi.fn() } }
})

describe('SceneManager', () => {
  let canvas: HTMLCanvasElement
  let sm: SceneManager

  beforeEach(() => {
    canvas = document.createElement('canvas')
    sm = new SceneManager()
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true })
  })

  afterEach(() => { sm.destroy() })

  it('initializes pixi app on canvas', async () => {
    await sm.init(canvas)
    expect(sm.app).toBeDefined()
    expect(sm.app).not.toBeNull()
  })

  it('world container scale fits letterbox', async () => {
    await sm.init(canvas)
    expect(sm.world.scale.x).toBe(2.0)
    expect(sm.world.scale.y).toBe(2.0)
  })

  it('destroy releases resources', async () => {
    await sm.init(canvas)
    sm.destroy()
    expect(sm.app).toBeNull()
  })

  it('applies custom cursor on non-touch device', async () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true })
    await sm.init(canvas)
    expect(canvas.style.cursor).toContain('url(')
  })

  it('does not apply custom cursor on touch device', async () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 1, configurable: true })
    await sm.init(canvas)
    expect(canvas.style.cursor).not.toContain('url(')
  })
})
