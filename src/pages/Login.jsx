import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authService } from '../api/services'
import { runtimeConfig } from '../config/runtimeConfig'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../api/errorParser'

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
        <div className="login-split-page">
            <div className="login-left">
                <div className="login-form-container">
                    <div style={{color: '#4f46e5', marginBottom: '40px'}}><svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2z"/></svg></div>
                    <h1>Welcome back !</h1>
                    <p className="subtitle">Enter to get unlimited access to data & information.</p>
                    
                    <form onSubmit={onSubmit}>
                        <div className="login-field">
                            <label>Email *</label>
                            <input 
                                type="email" 
                                placeholder="Enter your mail address" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="login-field" style={{position: 'relative'}}>
                            <label>Password *</label>
                            <input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{position: 'absolute', right: '10px', top: '35px', background:'none', border:'none', cursor:'pointer', color:'#888'}}>
                                ????
                            </button>
                        </div>
                        
                        <div className="login-options">
                            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '400', color: '#1a1a2e'}}>
                                <input type="checkbox" style={{width: 'auto', margin: 0}} /> Remember me
                            </label>
                            <Link to="/forgot-password">Forgot your password ?</Link>
                        </div>
                        
                        {(error || clientError) && <div style={{color: 'red', marginBottom: '10px'}}>{error || clientError}</div>}
                        
                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? 'Logging in...' : 'Log In'}
                        </button>
                        
                        <div style={{textAlign: 'center', margin: '20px 0', color: '#888', fontSize: '14px', position: 'relative'}}>
                            <hr style={{position: 'absolute', width: '100%', top: '8px', border: 'none', borderTop: '1px solid #eee', zIndex: 1}} />
                            <span style={{background: 'white', padding: '0 10px', position: 'relative', zIndex: 2}}>Or, Login with</span>
                        </div>
                        
                        <button type="button" onClick={onGoogleLogin} style={{width: '100%', padding: '12px', background: 'white', border: '1px solid #d1d1e0', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', fontWeight: '600', color: '#1a1a2e'}}>
                            Signup with google
                        </button>
                        
                        <div style={{textAlign: 'center', marginTop: '30px', fontSize: '14px'}}>
                            Don't have an account? <Link to="/register" style={{color: '#4f46e5', fontWeight: '600'}}>Register here</Link>
                        </div>
                    </form>
                </div>
            </div>
            <div className="login-right"></div>
        </div>
    )
}

export default Login
