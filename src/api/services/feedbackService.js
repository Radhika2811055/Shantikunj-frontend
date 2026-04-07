import api from '../axios'

export const feedbackService = {
    submit(bookId, versionId, payload) {
        return api.post(`/feedback/books/${bookId}/versions/${versionId}`, payload)
    },

    list(bookId, versionId) {
        return api.get(`/feedback/books/${bookId}/versions/${versionId}`)
    },

    summary(bookId, versionId) {
        return api.get(`/feedback/books/${bookId}/versions/${versionId}/summary`)
    }
}
