import { Application, Container, Assets, Sprite } from 'pixi.js'
import { applyCursor } from './cursor'

export class SceneManager {
  app: Application | null = null
  world: Container = new Container()
  private resizeHandler: (() => void) | null = null

  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.app = new Application()
    await this.app.init({ canvas, resizeTo: window, background: '#1a1a2e' })
    this.app.stage.addChild(this.world)

    const texture = await Assets.load('/assets/room-bg.png')
    const bg = new Sprite(texture)
    // 原图 2274x1947，菱形内容大约占 90% 面积
    // 以宽度为基准保持比例
    const aspect = texture.height / texture.width
    bg.width = 960
    bg.height = 960 * aspect
    // 向下偏移让墙面区域更多露出
    bg.y = 45
    this.world.addChild(bg)

    this.fitCamera()
    this.resizeHandler = () => this.fitCamera()
    window.addEventListener('resize', this.resizeHandler)
    applyCursor(canvas)
  }

  private worldWidth = 960
  private worldHeight = 762 // 减去顶底空白后的有效高度

  private fitCamera(): void {
    // cover 模式：取较大缩放值，让图片填满视口
    const scale = Math.max(window.innerWidth / this.worldWidth, window.innerHeight / this.worldHeight)
    this.world.scale.set(scale)
    this.world.x = (window.innerWidth - this.worldWidth * scale) / 2
    this.world.y = (window.innerHeight - this.worldHeight * scale) / 2
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
