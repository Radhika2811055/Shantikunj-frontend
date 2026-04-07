import api from '../axios'

export const auditService = {
    list(params) {
        return api.get('/audit', { params })
    }
}
