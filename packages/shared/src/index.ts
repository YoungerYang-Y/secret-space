export enum AuthRole {
  OWNER = 'owner',
  VISITOR = 'visitor',
  ADMIN = 'admin',
}

export interface AuthVerifyRequest {
  password: string
}

export interface AuthVerifyResponse {
  token: string
  role: 'owner' | 'visitor' | 'admin'
}

// Composables
export { useThemeColor, rgbToHsl, hslToHex } from './composables/useThemeColor'
export type { ThemeColors } from './composables/useThemeColor'
