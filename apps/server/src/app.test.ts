import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from './app'

describe('server app', () => {
  const app = createApp()

  it('GET /healthz returns an ok envelope', async () => {
    const res = await request(app).get('/healthz')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, data: { status: 'ok', service: 'know-your-bite' } })
  })

  it('GET /api/v1/ping returns an ok envelope', async () => {
    const res = await request(app).get('/api/v1/ping')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, data: { pong: true } })
  })

  it('unknown /api route returns a 404 error envelope', async () => {
    const res = await request(app).get('/api/v1/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'API route not found' },
    })
  })
})
