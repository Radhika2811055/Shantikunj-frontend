import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getApiErrorMessage } from '../api/errorParser'
import { authService } from '../api/services'

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { data } = await authService.forgotPassword({ email })
      setMessage(data?.message || 'Reset link sent. Check your email inbox.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to send reset link'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <h2>Forgot Password</h2>
        <p>Enter your registered email to receive a reset link.</p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        {error && <div className="error-box">{error}</div>}
        {message && <div className="ok-box">{message}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>

        <p className="auth-link">
          Back to <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  )
}

export default ForgotPassword
