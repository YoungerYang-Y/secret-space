import { ref } from 'vue'

export interface ThemeColors {
  from: string
  to: string
  text: string
  sub: string
}

export function useThemeColor(defaultColors?: Partial<ThemeColors>) {
  const themeColors = ref<ThemeColors>({
    from: defaultColors?.from ?? '#fef9f4',
    to: defaultColors?.to ?? '#fde8d0',
    text: defaultColors?.text ?? '#8b5e3c',
    sub: defaultColors?.sub ?? '#a07050',
  })

  /** 从封面图提取主色，生成浅色渐变。
   *  不设置 crossOrigin —— 跨域图片在 <img> 中正常显示，
   *  canvas 会变 tainted 导致 getImageData 抛 SecurityError，
   *  此时静默回退到默认色。 */
  function extractFromImage(url: string) {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 64
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, size, size)
        // 跨域图片会 taint canvas，此处抛出 SecurityError
        const data = ctx.getImageData(0, 0, size, size).data

        let rSum = 0, gSum = 0, bSum = 0, count = 0
        for (let i = 0; i < data.length; i += 16) {
          if (data[i + 3] < 128) continue
          rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2]; count++
        }
        if (count < 10) return

        const r = rSum / count, g = gSum / count, b = bSum / count
        const { h, s, l } = rgbToHsl(r, g, b)

        const from = hslToHex(h, Math.min(s * 0.6, 0.5), 0.96)
        const to = hslToHex(h, Math.min(s * 0.7, 0.6), 0.86)
        const text = hslToHex(h, Math.min(s * 0.8, 0.6), 0.3)
        const sub = hslToHex(h, Math.min(s * 0.6, 0.5), 0.42)

        themeColors.value = { from, to, text, sub }
      } catch {
        // Canvas tainted（跨域图片无 CORS header）→ 保持默认色
      }
    }
    img.src = url
  }

  /** 将主题色应用到 DOM 元素 CSS 变量 */
  function applyToElement(el: HTMLElement | null) {
    if (!el) return
    const { from, to, text, sub } = themeColors.value
    el.style.setProperty('--theme-from', from)
    el.style.setProperty('--theme-to', to)
    el.style.setProperty('--theme-text', text)
    el.style.setProperty('--theme-sub', sub)
  }

  return { themeColors, extractFromImage, applyToElement }
}

// === 颜色空间转换工具（纯函数，可独立测试） ===

export function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return { h: h * 360, s, l }
}

export function hslToHex(h: number, s: number, l: number): string {
  h /= 360
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255)
  const g = Math.round(hue2rgb(p, q, h) * 255)
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
}
