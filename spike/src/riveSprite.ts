import { Rive, Fit, Alignment, Layout, StateMachineInput, EventType, type RiveParameters } from '@rive-app/canvas'
import { Sprite, Texture, CanvasSource } from 'pixi.js'
import { Application } from 'pixi.js'

export interface RiveSpriteOptions {
  src: string
  artboard?: string
  stateMachines?: string | string[]
  autoplay?: boolean
  width?: number
  height?: number
  app: Application
}

/**
 * Wraps a Rive animation as a PixiJS Sprite via an offscreen canvas.
 *
 * Rive renders to a hidden Canvas2D element. Each frame, we call
 * `canvasSource.update()` so PixiJS re-uploads the canvas content to the GPU.
 * The sprite is a first-class citizen in the PixiJS scene graph.
 */
export class RiveSprite extends Sprite {
  private rive: Rive
  private canvas: HTMLCanvasElement
  private canvasSource: CanvasSource
  private _app: Application
  private _loaded = false
  private _loadError: string | null = null

  constructor(opts: RiveSpriteOptions) {
    const w = opts.width ?? 256
    const h = opts.height ?? 256

    // 1. Create a DOM-attached canvas for Rive to render into.
    //    IMPORTANT: @rive-app/canvas only renders to canvases that are in the DOM.
    //    We position it offscreen so it's invisible but still live.
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.style.cssText = 'position:fixed;left:-9999px;top:-9999px;pointer-events:none;'
    document.body.appendChild(canvas)

    // 2. Explicitly create a CanvasSource so PixiJS treats this as a
    //    dynamic/live canvas texture rather than a one-shot image snapshot.
    const canvasSource = new CanvasSource({ resource: canvas, width: w, height: h, transparent: true })
    const texture = new Texture(canvasSource)
    super(texture)

    this.canvas = canvas
    this.canvasSource = canvasSource
    this._app = opts.app

    // 3. Build Rive constructor params
    const params: RiveParameters = {
      canvas,
      src: opts.src,
      autoplay: opts.autoplay ?? true,
      layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    }
    if (opts.artboard) params.artboard = opts.artboard
    if (opts.stateMachines) params.stateMachines = opts.stateMachines

    // 4. Create Rive instance
    console.log(`[RiveSprite] Creating Rive instance for ${opts.src}`)
    this.rive = new Rive(params)

    this.rive.on(EventType.Load, () => {
      this._loaded = true
      console.log(`[RiveSprite] Loaded ${opts.src}`, {
        artboard: this.rive.activeArtboard,
        animations: this.rive.animationNames,
        stateMachines: this.rive.stateMachineNames,
        playing: this.rive.isPlaying,
      })
    })
    this.rive.on(EventType.LoadError, (event) => {
      this._loadError = String(event.data ?? 'unknown load error')
      console.error(`[RiveSprite] Load error for ${opts.src}:`, this._loadError, event)
    })
    this.rive.on(EventType.Play, () => {
      console.log(`[RiveSprite] Playing ${opts.src}`)
    })
    this.rive.on(EventType.Pause, () => {
      console.log(`[RiveSprite] Paused ${opts.src}`)
    })

    // 5. Register texture update: each frame, tell PixiJS the canvas content
    //    may have changed so it re-uploads to the GPU.
    this._app.ticker.add(this._updateTexture, this)
  }

  // ── texture update ────────────────────────────────────────────────

  private _updateTexture() {
    if (this.destroyed) return
    try {
      this.canvasSource.update()
    } catch {
      // texture may be invalid during cleanup
    }
  }

  // ── public API ────────────────────────────────────────────────────

  get isLoaded(): boolean {
    return this._loaded
  }

  get loadError(): string | null {
    return this._loadError
  }

  get riveInstance(): Rive {
    return this.rive
  }

  resize(w: number, h: number) {
    this.canvas.width = w
    this.canvas.height = h
    this.canvasSource.resize(w, h)
  }

  // ── state machine helpers ─────────────────────────────────────────

  getInputs(stateMachineName: string): StateMachineInput[] | undefined {
    try {
      const inputs = this.rive.stateMachineInputs(stateMachineName)
      return inputs.length > 0 ? inputs : undefined
    } catch {
      return undefined
    }
  }

  setBooleanInput(stateMachine: string, inputName: string, value: boolean) {
    const input = this.getInputs(stateMachine)?.find((i) => i.name === inputName)
    if (input) input.value = value
  }

  setNumberInput(stateMachine: string, inputName: string, value: number) {
    const input = this.getInputs(stateMachine)?.find((i) => i.name === inputName)
    if (input) input.value = value
  }

  fireTrigger(stateMachine: string, inputName: string) {
    const input = this.getInputs(stateMachine)?.find((i) => i.name === inputName)
    if (input) input.fire()
  }

  // ── playback ──────────────────────────────────────────────────────

  play(names?: string | string[]) {
    this.rive.play(names)
  }

  pause(names?: string | string[]) {
    this.rive.pause(names)
  }

  stop(names?: string | string[]) {
    this.rive.stop(names)
  }

  get playing(): boolean {
    return this.rive.isPlaying
  }

  // ── lifecycle ─────────────────────────────────────────────────────

  cleanup() {
    this._app?.ticker?.remove(this._updateTexture, this)
    try {
      this.rive.cleanup()
      this.rive.deleteRiveRenderer()
    } catch {
      // ignore double-cleanup errors
    }
    // Remove the hidden canvas from DOM
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas)
    }
    this.destroy()
  }
}
