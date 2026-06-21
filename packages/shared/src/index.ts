export enum AuthRole {
  OWNER = 'owner',
  VISITOR = 'visitor',
}

export interface AuthVerifyRequest {
  password: string
}

export interface AuthVerifyResponse {
  token: string
  role: 'owner' | 'visitor'
}
