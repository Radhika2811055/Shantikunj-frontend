const trimTrailingSlashes = (value) => String(value || '').replace(/\/+$/, '')

const normalizeBaseUrl = (rawBaseUrl) => {
    const base = trimTrailingSlashes(rawBaseUrl)
    if (!base) return ''

    if (base === '/api') return ''

    if (base.endsWith('/api')) {
        return base.slice(0, -4)
    }

    return base
}

const validateBaseUrl = (baseUrl) => {
    if (!baseUrl) {
        throw new Error('[Startup Config] Missing VITE_API_BASE_URL. Define it in .env (e.g. VITE_API_BASE_URL=http://localhost:5000).')
    }

    const isRelative = baseUrl.startsWith('/')
    if (isRelative) return

    try {
        const parsedUrl = new URL(baseUrl)
        if (!parsedUrl?.origin) {
            throw new Error('Invalid URL origin')
        }
    } catch {
        throw new Error(`[Startup Config] Invalid VITE_API_BASE_URL: "${baseUrl}". Use an absolute URL like http://localhost:5000.`)
    }
}

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL
const normalizedBaseUrl = normalizeBaseUrl(rawBaseUrl)

validateBaseUrl(normalizedBaseUrl)

export const runtimeConfig = {
    apiBaseUrl: normalizedBaseUrl,
    apiPrefix: '/api',
    apiRoot: `${normalizedBaseUrl}/api`
}
