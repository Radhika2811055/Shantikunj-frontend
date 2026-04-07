import api from '../axios'

export const booksService = {
    createBook(payload) {
        return api.post('/books', payload)
    },

    listBooks(params) {
        return api.get('/books', { params })
    },

    myAssignments() {
        return api.get('/books/my-assignments')
    },

    getBook(bookId) {
        return api.get(`/books/${bookId}`)
    },

    assignVersion(bookId, versionId, payload) {
        return api.put(`/books/${bookId}/versions/${versionId}/assign`, payload)
    },

    reassignVersion(bookId, versionId, payload) {
        return api.put(`/books/${bookId}/versions/${versionId}/reassign`, payload)
    },

    setBlocker(bookId, versionId, payload) {
        return api.put(`/books/${bookId}/versions/${versionId}/blocker`, payload)
    },

    publishVersion(bookId, versionId) {
        return api.put(`/books/${bookId}/versions/${versionId}/publish`)
    },

    updateTextStatus(bookId, versionId, payload) {
        return api.put(`/books/${bookId}/versions/${versionId}/text-status`, payload)
    },

    updateAudioStatus(bookId, versionId, payload) {
        return api.put(`/books/${bookId}/versions/${versionId}/audio-status`, payload)
    },

    uploadTranslationDocument(formData) {
        return api.post('/books/upload-translation-doc', formData)
    },

    uploadAudioFile(formData) {
        return api.post('/books/upload-audio-file', formData)
    },

    submitTranslation(bookId, versionId, payload) {
        return api.post(`/books/${bookId}/versions/${versionId}/submit-translation`, payload)
    },

    submitVettedText(bookId, versionId, payload) {
        return api.post(`/books/${bookId}/versions/${versionId}/submit-vetted-text`, payload)
    },

    submitSpocReview(bookId, versionId, payload) {
        return api.put(`/books/${bookId}/versions/${versionId}/spoc-review`, payload)
    },

    submitAudio(bookId, versionId, payload) {
        return api.post(`/books/${bookId}/versions/${versionId}/submit-audio`, payload)
    },

    submitAudioReview(bookId, versionId, payload) {
        return api.post(`/books/${bookId}/versions/${versionId}/submit-audio-review`, payload)
    },

    submitSpocAudioApproval(bookId, versionId, payload) {
        return api.put(`/books/${bookId}/versions/${versionId}/spoc-audio-approval`, payload)
    }
}
