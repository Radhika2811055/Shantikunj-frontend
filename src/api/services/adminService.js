import api from '../axios'

export const adminService = {
    getPendingUsers() {
        return api.get('/admin/users/pending')
    },

    getAllUsers() {
        return api.get('/admin/users/all')
    },

    approveUser(userId, payload = {}) {
        return api.put(`/admin/users/${userId}/approve`, payload)
    },

    rejectUser(userId, payload = {}) {
        return api.put(`/admin/users/${userId}/reject`, payload)
    },

    deleteUser(userId) {
        return api.delete(`/admin/users/${userId}`)
    }
}
