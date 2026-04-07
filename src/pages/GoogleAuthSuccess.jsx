import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const GoogleAuthSuccess = () => {
  const { completeSessionFromToken } = useAuth()
  const processedRef = useRef(false)

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true

    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const id = params.get('id')
    const name = params.get('name')
    const email = params.get('email')
    const role = params.get('role')
    const language = params.get('language')

    if (!token) {
      return
    }

    completeSessionFromToken(token, {
      id: id || null,
      name: name || 'Google User',
      email: email || '',
      role: role || 'pending',
      language: language || null
    })

    // Hard redirect avoids any router/state race during OAuth callback.
    window.location.replace('/dashboard')
  }, [completeSessionFromToken])

  const hasToken = new URLSearchParams(window.location.search).get('token')

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h2>Signing you in...</h2>
        {hasToken ? (
          <p>Please wait while we complete Google login.</p>
        ) : (
          <p>Google login callback token missing. Please <Link to="/login">try again</Link>.</p>
        )}
      </div>
    </div>
  )
}

export default GoogleAuthSuccess
