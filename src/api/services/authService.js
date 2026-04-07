import api from '../axios'

/**
 * @typedef {Object} LoginResponse
 * @property {string} token
 * @property {{id?: string, _id?: string, name?: string, email?: string, role?: string, language?: string}} user
 */

export const authService = {
    register(payload) {
        return api.post('/auth/register', payload, { skipUnauthorizedHandler: true })
    },

    /** @returns {Promise<import('axios').AxiosResponse<LoginResponse>>} */
    login(payload) {
        return api.post('/auth/login', payload, { skipUnauthorizedHandler: true })
    },

    me() {
        return api.get('/auth/me')
    },

    languageMembers() {
        return api.get('/auth/language-members')
    },

    forgotPassword(payload) {
        return api.post('/auth/forgot-password', payload, { skipUnauthorizedHandler: true })
    },

    resetPassword(token, payload) {
        return api.post(`/auth/reset-password/${token}`, payload, { skipUnauthorizedHandler: true })
    },

    googleLoginEntry() {
        return api.get('/auth/google', { skipUnauthorizedHandler: true })
    },

    googleCallback(params) {
        return api.get('/auth/google/callback', {
            params,
            skipUnauthorizedHandler: true
        })
    }
}
