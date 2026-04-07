import axios from 'axios'
import { runtimeConfig } from '../config/runtimeConfig'
import { withApiErrorMessage } from './errorParser'

const pendingRequestControllers = new Map()
const retryableStatusCodes = new Set([500, 502, 503, 504])

let unauthorizedDispatchCooldownMs = 0

const createRequestId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const wait = (ms) => new Promise((resolve) => {
    window.setTimeout(resolve, ms)
})

export const api = axios.create({
    baseURL: `${runtimeConfig.apiBaseUrl}${runtimeConfig.apiPrefix}`,
    timeout: 20000
})

const cleanupPendingRequest = (config) => {
    const requestId = config?.__requestId
    if (requestId) {
        pendingRequestControllers.delete(requestId)
    }
}

const shouldRetryGetRequest = (error) => {
    const method = String(error?.config?.method || 'get').toLowerCase()
    if (method !== 'get') return false

    if (error?.code === 'ERR_CANCELED') return false

    const status = error?.response?.status
    if (status && retryableStatusCodes.has(status)) return true

    const networkError = !status && Boolean(error?.request)
    return networkError
}

api.interceptors.request.use((config) => {
    const requestConfig = { ...config }

    const token = localStorage.getItem('token')
    if (token) {
        requestConfig.headers = {
            ...(requestConfig.headers || {}),
            Authorization: `Bearer ${token}`
        }
    }

    if (!requestConfig.signal) {
        const controller = new AbortController()
        const requestId = createRequestId()

        requestConfig.signal = controller.signal
        requestConfig.__requestId = requestId
        pendingRequestControllers.set(requestId, controller)
    }

    return requestConfig
})

api.interceptors.response.use(
    (response) => {
        cleanupPendingRequest(response.config)
        return response
    },
    async (error) => {
        cleanupPendingRequest(error?.config)

        const originalRequest = error?.config || {}
        const retryCount = Number(originalRequest.__retryCount || 0)

        if (shouldRetryGetRequest(error) && retryCount < 2) {
            originalRequest.__retryCount = retryCount + 1
            const retryDelayMs = originalRequest.__retryCount * 300
            await wait(retryDelayMs)
            return api.request(originalRequest)
        }

        const status = error?.response?.status
        const skipUnauthorizedHandler = Boolean(originalRequest?.skipUnauthorizedHandler)
        const now = Date.now()

        if (status === 401 && !skipUnauthorizedHandler && now - unauthorizedDispatchCooldownMs > 1000) {
            unauthorizedDispatchCooldownMs = now
            window.dispatchEvent(new CustomEvent('app:unauthorized'))
        }

        return Promise.reject(withApiErrorMessage(error))
    }
)

export const cancelAllPendingRequests = (reason = 'Route changed') => {
    pendingRequestControllers.forEach((controller) => {
        controller.abort(reason)
    })
    pendingRequestControllers.clear()
}

export const isRequestCanceled = (error) => {
    return error?.code === 'ERR_CANCELED' || axios.isCancel(error)
}
