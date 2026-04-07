import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cancelAllPendingRequests } from '../api/httpClient'
import { useAuth } from '../context/AuthContext'

export const useGlobalApiGuards = () => {
    const { logout } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()

    useEffect(() => {
        const onUnauthorized = () => {
            logout()
            navigate('/login', { replace: true })
        }

        window.addEventListener('app:unauthorized', onUnauthorized)

        return () => {
            window.removeEventListener('app:unauthorized', onUnauthorized)
        }
    }, [logout, navigate])

    useEffect(() => {
        cancelAllPendingRequests('Route changed')
    }, [location.pathname, location.search])
}
