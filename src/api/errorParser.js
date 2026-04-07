const extractMessageFromPayload = (payload) => {
    if (!payload) return ''

    if (typeof payload === 'string') {
        return payload.trim()
    }

    if (Array.isArray(payload)) {
        const firstMessage = payload
            .map((item) => extractMessageFromPayload(item))
            .find(Boolean)

        return firstMessage || ''
    }

    if (typeof payload === 'object') {
        if (typeof payload.message === 'string' && payload.message.trim()) {
            return payload.message.trim()
        }

        if (Array.isArray(payload.message)) {
            const firstFromArray = payload.message
                .map((item) => extractMessageFromPayload(item))
                .find(Boolean)

            if (firstFromArray) return firstFromArray
        }

        if (typeof payload.error === 'string' && payload.error.trim()) {
            return payload.error.trim()
        }

        if (typeof payload.details === 'string' && payload.details.trim()) {
            return payload.details.trim()
        }
    }

    return ''
}

export const getApiErrorMessage = (error, fallback = 'Request failed. Please try again.') => {
    if (!error) return fallback

    const responseMessage = extractMessageFromPayload(error?.response?.data)
    if (responseMessage) return responseMessage

    if (error?.code === 'ERR_CANCELED') {
        return 'Request cancelled.'
    }

    if (typeof error?.message === 'string' && error.message.trim()) {
        return error.message.trim()
    }

    return fallback
}

export const withApiErrorMessage = (error, fallback) => {
    const userMessage = getApiErrorMessage(error, fallback)
    // Attach a normalized, frontend-safe message while preserving original axios error shape.
    return Object.assign(error, { userMessage })
}
