import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AudioManager } from '../AudioManager'

const mockPlay = vi.fn().mockReturnValue(1)
const mockStop = vi.fn()
const mockFade = vi.fn()
const mockLoop = vi.fn()
const mockUnload = vi.fn()

vi.mock('howler', () => ({
  Howl: vi.fn().mockImplementation(() => ({
    play: mockPlay,
    stop: mockStop,
    fade: mockFade,
    loop: mockLoop,
    unload: mockUnload,
  })),
  Howler: { ctx: { state: 'suspended', resume: vi.fn() } },
}))

describe('AudioManager', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('starts as not unlocked', () => {
    const am = new AudioManager()
    expect(am.unlocked).toBe(false)
  })

  it('unlock sets unlocked to true', () => {
    const am = new AudioManager()
    am.unlock()
    expect(am.unlocked).toBe(true)
  })

  it('playSfx returns true when sound registered and unlocked', () => {
    const am = new AudioManager()
    am.unlock()
    am.registerSfx('door', '/audio/door.webm')
    expect(am.playSfx('door')).toBe(true)
  })

  it('playSfx returns false for unknown id', () => {
    const am = new AudioManager()
    am.unlock()
    expect(am.playSfx('nonexistent')).toBe(false)
  })

  it('playSfx returns false when not unlocked', () => {
    const am = new AudioManager()
    am.registerSfx('door', '/audio/door.webm')
    expect(am.playSfx('door')).toBe(false)
  })
})
