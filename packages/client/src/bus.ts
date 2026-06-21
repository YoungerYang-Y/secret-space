import mitt from 'mitt'

type Events = {
  'camera:zoomIn': string
  'camera:zoomOut': void
  'camera:zoneChanged': string
  'audio:unlock': void
}

export const bus = mitt<Events>()
