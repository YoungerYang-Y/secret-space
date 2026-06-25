import { Howl, Howler } from 'howler'

export class AudioManager {
  private _unlocked = false
  private sfxMap = new Map<string, Howl>()
  private ambientHowl: Howl | null = null

  get unlocked(): boolean { return this._unlocked }

  unlock(): void {
    if (Howler.ctx?.state === 'suspended') Howler.ctx.resume()
    this._unlocked = true
  }

  registerSfx(id: string, src: string): void {
    this.sfxMap.set(id, new Howl({ src: [src] }))
  }

  playSfx(id: string): boolean {
    if (!this._unlocked) return false
    const howl = this.sfxMap.get(id)
    if (!howl) return false
    howl.play()
    return true
  }

  playAmbient(season: 'spring' | 'summer' | 'autumn' | 'winter'): void {
    if (!this._unlocked) return
    this.ambientHowl?.stop()
    const src = `/audio/ambient-${season}.webm`
    this.ambientHowl = new Howl({ src: [src], loop: true, volume: 0 })
    this.ambientHowl.play()
    this.ambientHowl.fade(0, 0.3, 1000)
  }

  stopAll(): void {
    this.ambientHowl?.stop()
    this.sfxMap.forEach(h => h.stop())
  }
}

export const audioManager = new AudioManager()

// 注册翻页音效
audioManager.registerSfx('page-flip', '/audio/page-flip.wav')
