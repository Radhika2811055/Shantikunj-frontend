import api from '../axios'

export const notificationsService = {
    myNotifications() {
        return api.get('/notifications/my')
    },

    markRead(notificationId) {
        return api.put(`/notifications/${notificationId}/read`)
    },

    markAllRead() {
        return api.put('/notifications/read-all')
    },

    deleteNotification(notificationId) {
        return api.delete(`/notifications/${notificationId}`)
    },

    cleanupOld(params) {
        return api.delete('/notifications/cleanup/old', { params })
    }
}
