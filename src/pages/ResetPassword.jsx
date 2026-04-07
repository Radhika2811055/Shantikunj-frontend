import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getApiErrorMessage } from '../api/errorParser'
import { authService } from '../api/services'

const ResetPassword = () => {
  const navigate = useNavigate()
  const { token } = useParams()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { data } = await authService.resetPassword(token, { newPassword })
      setMessage(data?.message || 'Password reset successful')
      setTimeout(() => navigate('/login'), 1200)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to reset password'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <h2>Reset Password</h2>
        <p>Create a new password for your account.</p>

        <label htmlFor="newPassword">New Password</label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />

        <label htmlFor="confirmPassword">Confirm Password</label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />

        {error && <div className="error-box">{error}</div>}
        {message && <div className="ok-box">{message}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Updating...' : 'Reset Password'}
        </button>

        <p className="auth-link">
          Back to <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  )
}

export default ResetPassword
