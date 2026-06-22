import { describe, it, expect } from 'vitest'
import { AuthRole } from '../index'

describe('shared exports', () => {
  it('exports AuthRole type values', () => {
    expect(AuthRole.OWNER).toBe('owner')
    expect(AuthRole.VISITOR).toBe('visitor')
  })
})
