import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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
	const searchParams = new URLSearchParams(location.search)
	const verified = searchParams.get('verified')
	const errorCode = searchParams.get('error')
	const [flashMessage] = useState(() => {
		if (verified === '1') {
			return 'Email verified successfully. You can login after admin approval.'
		}
		return ''
	})
	const [flashError] = useState(() => {
		if (errorCode === 'google_failed') return 'Google login failed. Please try again.'
		if (errorCode === 'server_error') return 'Server error during Google login. Please try again.'
		if (errorCode === 'pending') return 'Your Google account is pending admin approval.'
		if (errorCode === 'verify_link_invalid' || errorCode === 'verify_failed') {
			return 'Email verification link is invalid or expired. Please register again.'
		}
		return ''
	})

	useEffect(() => {
		setError('')

		if (location.search) {
			navigate('/login', { replace: true })
		}
	}, [location.search, navigate, setError])

	const emailError = !email.trim()
		? 'Email is required.'
		: !EMAIL_REGEX.test(email.trim())
			? 'Enter a valid email address.'
			: ''

	const passwordError = !password
		? 'Password is required.'
		: password.length < 8
			? 'Password must be at least 8 characters.'
			: ''

	const hasValidationError = Boolean(emailError || passwordError)

	const onSubmit = async (event) => {
		event.preventDefault()
		setTouched({ email: true, password: true })
		setClientError('')
		if (hasValidationError) {
			setClientError('Please fix the highlighted fields.')
			return
		}
		const result = await login(email.trim().toLowerCase(), password)
		if (result.ok) {
			navigate('/dashboard')
		}
	}

	return (
		<div className="auth-page">
			<div className="auth-layout">
				<section className="auth-brand-panel">
					<p className="eyebrow">LMS AudioBook</p>
					<h1>Secure Access For LMS Publishing Teams</h1>
					<p>Track translation, review and production progress with role-based workflows.</p>
				</section>

				<form className="auth-card auth-card-modern" onSubmit={onSubmit}>
					<h2>Welcome Back</h2>
					<p>Login to continue workflow operations.</p>

					<label htmlFor="email">Email</label>
					<input
						id="email"
						type="email"
						value={email}
						className={touched.email && emailError ? 'input-error' : ''}
						onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
						onChange={(event) => {
							setEmail(event.target.value)
							if (error) setError('')
						}}
						required
					/>
					{touched.email && emailError && <span className="field-error">{emailError}</span>}

					<label htmlFor="password">Password</label>
					<div className="password-wrap">
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
							value={password}
							className={touched.password && passwordError ? 'input-error' : ''}
							onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
							onChange={(event) => {
								setPassword(event.target.value)
								if (error) setError('')
							}}
							required
						/>
						<button
							type="button"
							className="toggle-pass"
							onClick={() => setShowPassword((prev) => !prev)}
						>
							{showPassword ? 'Hide' : 'Show'}
						</button>
					</div>
					{touched.password && passwordError && <span className="field-error">{passwordError}</span>}

					{clientError && <div className="error-box">{clientError}</div>}
					{flashMessage && <div className="ok-box">{flashMessage}</div>}
					{flashError && <div className="error-box">{flashError}</div>}
					{error && <div className="error-box">{error}</div>}

					<p className="auth-link auth-link-right">
						<Link to="/forgot-password">Forgot password?</Link>
					</p>

					<button type="submit" disabled={loading}>{loading ? 'Please wait...' : 'Login'}</button>

					<button
						type="button"
						className="google-btn"
						onClick={() => {
							window.location.href = '/api/auth/google'
						}}
					>
						Continue with Google
					</button>

					<p className="auth-link">
						No account? <Link to="/register">Create one</Link>
					</p>
				</form>
			</div>
		</div>
	)
}

export default Login
