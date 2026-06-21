export function applyCursor(canvas: HTMLCanvasElement): void {
  if (navigator.maxTouchPoints > 0) return
  canvas.style.cursor = 'url(/assets/cursor-default.png), auto'
}
