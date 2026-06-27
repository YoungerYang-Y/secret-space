export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('token')
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(url, { ...init, headers })
}
