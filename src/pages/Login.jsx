import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authService } from '../api/services'
import { runtimeConfig } from '../config/runtimeConfig'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../api/errorParser'
import LoginParticleCanvas from '../components/LoginParticleCanvas'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const Login = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { login, loading, error, setError } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [touched, setTouched] = useState({ email: false, password: false })
    const [clientError, setClientError] = useState('')
    const [oauthError, setOauthError] = useState('')

    const searchParams = new URLSearchParams(location.search)
    const verified = searchParams.get('verified')
    const errorCode = searchParams.get('error')

    useEffect(() => {
        setError('')
        if (location.search) {
            navigate('/login', { replace: true })
        }
    }, [location.search, navigate, setError])

    const emailError = !email.trim() ? 'Email is required.' : !EMAIL_REGEX.test(email.trim()) ? 'Enter a valid email.' : ''
    const passwordError = !password ? 'Password is required.' : password.length < 8 ? 'Password must be at least 8 characters.' : ''
    const hasValidationError = Boolean(emailError || passwordError)

    const onSubmit = async (event) => {
        event.preventDefault()
        setTouched({ email: true, password: true })
        setClientError('')
        if (hasValidationError) {
            setClientError('Please fix highlighted fields.')
            return
        }
        const result = await login(email.trim().toLowerCase(), password)
        if (result.ok) {
            navigate('/dashboard')
        }
    }

    const onGoogleLogin = async () => {
        setOauthError('')
        try {
            const response = await authService.googleLoginEntry()
            const redirectUrl = typeof response?.data === 'string' ? response.data : response?.data?.url || response?.data?.redirectUrl
            if (redirectUrl) {
                window.location.assign(redirectUrl)
                return
            }
            window.location.assign(`${runtimeConfig.apiRoot}/auth/google`)
        } catch (error) {
            setOauthError(getApiErrorMessage(error, 'Google login failed.'))
        }
    }

    return (
        <div className="login-page">
            <LoginParticleCanvas />
            <div className="login-page-vignette" />

            <div className="login-card-shell">
                <div className="login-form-container login-form-pro">
                    <div className="login-brand-mark">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2L2 22h20L12 2z"/></svg>
                        <span>Shantikunj</span>
                    </div>

                    <h1>Welcome Back</h1>
                    <p className="subtitle">Sign in to continue with your workspace and tasks.</p>

                    {verified === 'true' && <div className="login-notice login-notice-ok">Email verified successfully. Please log in.</div>}
                    {errorCode && <div className="login-notice login-notice-error">Authentication session expired. Please login again.</div>}

                    <form onSubmit={onSubmit}>
                        <div className="login-field">
                            <label>Email *</label>
                            <input
                                type="email"
                                placeholder="Enter your email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                                className={touched.email && emailError ? 'login-input-error' : ''}
                                required
                            />
                            {touched.email && emailError && <p className="login-field-error">{emailError}</p>}
                        </div>

                        <div className="login-field login-password-field">
                            <label>Password *</label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                                className={touched.password && passwordError ? 'login-input-error' : ''}
                                required
                            />
                            <button
                                type="button"
                                className="login-pass-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                            {touched.password && passwordError && <p className="login-field-error">{passwordError}</p>}
                        </div>

                        <div className="login-options">
                            <label className="login-remember-toggle">
                                <input type="checkbox" />
                                <span>Remember me</span>
                            </label>
                            <Link to="/forgot-password">Forgot your password?</Link>
                        </div>

                        {(error || clientError) && <div className="login-notice login-notice-error">{error || clientError}</div>}

                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? 'Logging in...' : 'Log In'}
                        </button>

                        <div className="login-divider">
                            <hr />
                            <span>or continue with</span>
                        </div>

                        <button type="button" onClick={onGoogleLogin} className="login-google-btn">
                            Sign in with Google
                        </button>

                        {oauthError && <div className="login-notice login-notice-error">{oauthError}</div>}

                        <div className="login-register-link">
                            Don&apos;t have an account? <Link to="/register">Register here</Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default Login
