import { execSync } from 'child_process'

export function setup() {
  const env = { ...process.env, DATABASE_URL: 'file:./test.db' }
  execSync('npx prisma migrate deploy', { env })
  execSync('npx tsx prisma/seed.ts', { env })
}
