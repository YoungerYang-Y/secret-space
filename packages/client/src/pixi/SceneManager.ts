import { Application, Container } from 'pixi.js'
import { applyCursor } from './cursor'

export class SceneManager {
  app: Application | null = null
  world: Container = new Container()
  private resizeHandler: (() => void) | null = null

  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.app = new Application()
    await this.app.init({ canvas, resizeTo: window, background: '#000000' })
    this.app.stage.addChild(this.world)
    this.fitCamera()
    this.resizeHandler = () => this.fitCamera()
    window.addEventListener('resize', this.resizeHandler)
    applyCursor(canvas)
  }

  private fitCamera(): void {
    const scale = Math.min(window.innerWidth / 960, window.innerHeight / 540)
    this.world.scale.set(scale)
    this.world.x = (window.innerWidth - 960 * scale) / 2
    this.world.y = (window.innerHeight - 540 * scale) / 2
  }

  destroy(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler)
      this.resizeHandler = null
    }
    if (this.app) {
      this.app.destroy(true)
      this.app = null
    }
  }
}
