import api from '../axios'

export const supportService = {
    create(payload) {
        return api.post('/support', payload)
    },

    myRequests(params) {
        return api.get('/support/my', { params })
    },

    allRequests(params) {
        return api.get('/support', { params })
    },

    updateStatus(requestId, payload) {
        return api.put(`/support/${requestId}/status`, payload)
    }
}
