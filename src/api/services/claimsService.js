import api from '../axios'

export const claimsService = {
    sendInterest(bookId, payload) {
        return api.post(`/claims/books/${bookId}/send-interest`, payload)
    },

    claimBook(bookId, payload) {
        return api.post(`/claims/books/${bookId}/claim`, payload)
    },

    available(params) {
        return api.get('/claims/available', { params })
    },

    myClaim() {
        return api.get('/claims/my-claim')
    },

    myHistory(params) {
        return api.get('/claims/my-history', { params })
    }
}
