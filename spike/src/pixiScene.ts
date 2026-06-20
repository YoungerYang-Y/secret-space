import { Application, Container, Sprite, Assets } from 'pixi.js'
import gsap from 'gsap'
import { EventType } from '@rive-app/canvas'
import { bus } from './eventBus'
import { RiveSprite } from './riveSprite'

// ── art asset catalog ─────────────────────────────────────────────
// All AI-generated PNGs in public/rive-assets/

const ROOM_BG = 'isometric-room-pastel.png' // 2274×1947 full room

interface ZoneDef {
  id: string
  label: string
  asset: string
  /** natural size of the asset */
  w: number
  h: number
  /** position in world space (960×540) */
  x: number
  y: number
  /** display size in world space */
  displayW: number
  displayH: number
}

const zones: ZoneDef[] = [
  // bed: left side of room, near the back wall
  { id: 'bed', label: '床铺区', asset: 'bed-with-heart-pillows.png', w: 261, h: 200, x: 60, y: 260, displayW: 170, displayH: 130 },
  // desk: right-center, against the wall
  { id: 'desk', label: '书桌区', asset: 'pink-desk-with-computer.png', w: 200, h: 213, x: 500, y: 240, displayW: 130, displayH: 138 },
  // wardrobe: back-right corner, tall item
  { id: 'wardrobe', label: '衣柜区', asset: 'cute-wardrobe-sheep.png', w: 390, h: 642, x: 700, y: 80, displayW: 130, displayH: 214 },
]

/** Decorative props placed on the room background (non-interactive) */
const props: Array<{ asset: string; x: number; y: number; scale: number }> = [
  // hanging plant: top-left, near ceiling
  { asset: 'hanging-plant-kawaii.png', x: 140, y: 50, scale: 0.2 },
  // star lamp: top-center, ceiling
  { asset: 'star-pendant-lamp.png', x: 420, y: 30, scale: 0.15 },
  // cat backpack: near bed on the floor
  { asset: 'pink-cat-backpack.png', x: 200, y: 350, scale: 0.18 },
  // cat planter: near wardrobe
  { asset: 'cat-planter-with-leaves.png', x: 760, y: 300, scale: 0.22 },
  // ukulele: leaning against wall
  { asset: 'pink-ukulele.png', x: 400, y: 360, scale: 0.16 },
  // palette: on/near desk
  { asset: 'palette-and-brushes.png', x: 540, y: 340, scale: 0.16 },
]

let app: Application
let world: Container
let isZoomed = false
let currentZoneIndex = 0

// Rive test objects
let riveSprites: RiveSprite[] = []
let riveByName = new Map<string, RiveSprite>()

function fitCamera() {
  if (!app || isZoomed) return
  const scale = Math.min(window.innerWidth / 960, window.innerHeight / 540)
  world.scale.set(scale)
  world.x = (window.innerWidth - 960 * scale) / 2
  world.y = (window.innerHeight - 540 * scale) / 2
}

function zoomTo(zone: ZoneDef) {
  if (isZoomed) return
  isZoomed = true
  currentZoneIndex = zones.indexOf(zone)

  const targetScale = 2.5
  const pivotX = zone.x + zone.displayW / 2
  const pivotY = zone.y + zone.displayH / 2

  gsap.to(world, {
    duration: 0.6,
    ease: 'power2.inOut',
    x: window.innerWidth / 2 - pivotX * targetScale,
    y: window.innerHeight / 2 - pivotY * targetScale,
  })
  gsap.to(world.scale, { x: targetScale, y: targetScale, duration: 0.6, ease: 'power2.inOut' })
}

function zoomOut() {
  if (!isZoomed) return
  isZoomed = false

  const scale = Math.min(window.innerWidth / 960, window.innerHeight / 540)
  gsap.to(world, {
    duration: 0.5,
    ease: 'power2.inOut',
    x: (window.innerWidth - 960 * scale) / 2,
    y: (window.innerHeight - 540 * scale) / 2,
  })
  gsap.to(world.scale, { x: scale, y: scale, duration: 0.5, ease: 'power2.inOut' })
}

// ── Rive integration ──────────────────────────────────────────────

function emitStateMachineInfo(riveSprite: RiveSprite) {
  const smNames = riveSprite.riveInstance?.stateMachineNames ?? []
  const smDetails: Array<{ name: string; inputs: Array<{ name: string; type: string; value?: boolean | number }> }> = []

  for (const smName of smNames) {
    const inputs = riveSprite.riveInstance.stateMachineInputs(smName)
    if (!inputs) continue
    smDetails.push({
      name: smName,
      inputs: inputs.map((i) => ({
        name: i.name,
        type:
          i.type === 56 ? 'Number' : i.type === 58 ? 'Trigger' : i.type === 59 ? 'Boolean' : String(i.type),
        value: i.value,
      })),
    })
  }
  return smDetails
}

async function addRiveTestSprite(src: string, x: number, y: number, label: string) {
  const riveSprite = new RiveSprite({ src, app, width: 256, height: 256, autoplay: true })
  riveSprite.x = x
  riveSprite.y = y
  riveSprite.width = 120
  riveSprite.height = 120
  riveSprite.eventMode = 'static'
  riveSprite.cursor = 'pointer'

  riveSprite.riveInstance.on(EventType.Load, () => {
    bus.emit('rive:loaded', {
      label,
      src,
      artboard: riveSprite.riveInstance.activeArtboard,
      animations: riveSprite.riveInstance.animationNames ?? [],
      stateMachines: emitStateMachineInfo(riveSprite),
    })
  })

  riveSprite.riveInstance.on(EventType.LoadError, () => {
    bus.emit('rive:error', { label, src, error: riveSprite.loadError })
  })

  riveSprite.on('pointertap', () => {
    bus.emit('rive:click', { label, stateMachines: emitStateMachineInfo(riveSprite) })
  })

  world.addChild(riveSprite)
  riveSprites.push(riveSprite)
  riveByName.set(label, riveSprite)
  return riveSprite
}

function onRiveInput(data: { label: string; stateMachine: string; input: string; value?: boolean | number; trigger?: boolean }) {
  const rs = riveByName.get(data.label)
  if (!rs) return

  if (data.trigger) {
    rs.fireTrigger(data.stateMachine, data.input)
  } else if (typeof data.value === 'boolean') {
    rs.setBooleanInput(data.stateMachine, data.input, data.value)
  } else if (typeof data.value === 'number') {
    rs.setNumberInput(data.stateMachine, data.input, data.value)
  }
}

// ── exported init ──────────────────────────────────────────────────

export async function initPixiScene(canvas: HTMLCanvasElement) {
  app = new Application()
  await app.init({ canvas, resizeTo: window, background: '#fce4ec' })

  world = new Container()
  app.stage.addChild(world)

  // --- Load room background ---
  const bgTex = await Assets.load(`/rive-assets/${ROOM_BG}`)
  const bg = new Sprite(bgTex)
  // Scale 2274×1947 → fit 960×540 (maintain aspect ratio)
  const bgScale = Math.min(960 / bgTex.width, 540 / bgTex.height)
  bg.scale.set(bgScale)
  // Center in world
  bg.x = (960 - bgTex.width * bgScale) / 2
  bg.y = (540 - bgTex.height * bgScale) / 2
  world.addChild(bg)

  // --- Place interactive zone sprites ---
  for (const zone of zones) {
    const tex = await Assets.load(`/rive-assets/${zone.asset}`)
    const sprite = new Sprite(tex)
    sprite.x = zone.x
    sprite.y = zone.y
    sprite.width = zone.displayW
    sprite.height = zone.displayH
    sprite.eventMode = 'static'
    sprite.cursor = 'pointer'
    sprite.on('pointertap', () => {
      bus.emit('hotspot:click', { id: zone.id, label: zone.label, x: zone.x, y: zone.y })
      zoomTo(zone)
    })
    world.addChild(sprite)
  }

  // --- Place decorative props ---
  for (const p of props) {
    const tex = await Assets.load(`/rive-assets/${p.asset}`)
    const sprite = new Sprite(tex)
    sprite.x = p.x
    sprite.y = p.y
    sprite.scale.set(p.scale)
    world.addChild(sprite)
  }

  // --- Spike 1: Rive integration test ---
  await addRiveTestSprite('/rive-assets/teddy_login.riv', 20, 390, 'teddy')
  await addRiveTestSprite('/rive-assets/rating.riv', 830, 370, 'rating')
  // ----------------------------------------

  bus.on('panel:close', zoomOut)
  bus.on('rive:input', onRiveInput)
  fitCamera()
  window.addEventListener('resize', fitCamera)
}

export function destroyPixiScene() {
  for (const rs of riveSprites) {
    rs.cleanup()
  }
  riveSprites = []
  riveByName.clear()

  bus.off('panel:close', zoomOut)
  bus.off('rive:input', onRiveInput)
  window.removeEventListener('resize', fitCamera)
  app?.destroy(true, { children: true })
}

export function swipeToZone(direction: 'left' | 'right') {
  if (!isZoomed) return
  if (direction === 'right') currentZoneIndex = Math.min(currentZoneIndex + 1, zones.length - 1)
  else currentZoneIndex = Math.max(currentZoneIndex - 1, 0)

  const zone = zones[currentZoneIndex]
  const targetScale = 2.5
  gsap.to(world, {
    duration: 0.4,
    ease: 'power2.out',
    x: window.innerWidth / 2 - (zone.x + zone.displayW / 2) * targetScale,
    y: window.innerHeight / 2 - (zone.y + zone.displayH / 2) * targetScale,
  })

  bus.emit('camera:zoomIn', { zoneIndex: currentZoneIndex })
}

export { zones }
