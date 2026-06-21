import { Application, Container, Sprite, Assets } from 'pixi.js'

export class SceneManager {
  app: Application | null = null
  world: Container = new Container()

  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.app = new Application()
    await this.app.init({ canvas, resizeTo: window, background: '#000000' })
    this.app.stage.addChild(this.world)
    this.fitCamera()
    window.addEventListener('resize', () => this.fitCamera())
    this.applyCursor(canvas)
  }

  private fitCamera(): void {
    const scale = Math.min(window.innerWidth / 960, window.innerHeight / 540)
    this.world.scale.set(scale)
    this.world.x = (window.innerWidth - 960 * scale) / 2
    this.world.y = (window.innerHeight - 540 * scale) / 2
  }

  private applyCursor(canvas: HTMLCanvasElement): void {
    if (navigator.maxTouchPoints > 0) return
    canvas.style.cursor = 'url(/assets/cursor-default.png), auto'
  }

  destroy(): void {
    if (this.app) {
      this.app.destroy(true)
      this.app = null
    }
  }
}
