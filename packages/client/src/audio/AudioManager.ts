import { Howl, Howler } from 'howler'

type SfxId = string

export class AudioManager {
  private _unlocked = false
  /** 延迟注册：记录音效路径，unlock 后才创建 Howl 实例 */
  private pendingSfx = new Map<SfxId, string>()
  private sfxMap = new Map<SfxId, Howl>()
  private ambientHowl: Howl | null = null

  get unlocked(): boolean { return this._unlocked }

  unlock(): void {
    if (this._unlocked) return
    // 确保 AudioContext 在用户手势内创建/resume
    if (Howler.ctx?.state === 'suspended') {
      Howler.ctx.resume()
    }
    // 延迟实例化：现在才真正创建 Howl 对象
    this.pendingSfx.forEach((src, id) => {
      this.sfxMap.set(id, new Howl({ src: [src] }))
    })
    this.pendingSfx.clear()
    this._unlocked = true
  }

  registerSfx(id: SfxId, src: string): void {
    if (this._unlocked) {
      this.sfxMap.set(id, new Howl({ src: [src] }))
    } else {
      // 延迟：先记录路径，等 unlock 后再创建（避免提前触发 AudioContext）
      this.pendingSfx.set(id, src)
    }
  }

  playSfx(id: SfxId): boolean {
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

// 注册翻页音效（延迟实例化，等首次用户交互 unlock 后创建）
audioManager.registerSfx('page-flip', '/audio/page-flip.wav')
