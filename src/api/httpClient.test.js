import { describe, expect, it, vi } from 'vitest'

describe('httpClient', () => {
    it('uses VITE_API_BASE_URL with /api suffix', async () => {
        vi.resetModules()
        vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:5000')

        const { api } = await import('./httpClient')
        expect(api.defaults.baseURL).toBe('http://localhost:5000/api')
    })

    it('detects cancelled requests', async () => {
        vi.resetModules()
        vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:5000')

        const { isRequestCanceled } = await import('./httpClient')
        expect(isRequestCanceled({ code: 'ERR_CANCELED' })).toBe(true)
        expect(isRequestCanceled({ code: 'ERR_NETWORK' })).toBe(false)
    })
})
