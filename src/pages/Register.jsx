import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BLOCKED_DOMAINS = new Set([
	'test.com',
	'example.com',
	'mailinator.com',
	'yopmail.com',
	'guerrillamail.com',
	'10minutemail.com',
	'temp-mail.org',
	'fakeinbox.com'
])

const getPasswordStrength = (password) => {
	let score = 0
	if (password.length >= 8) score += 1
	if (/[A-Z]/.test(password)) score += 1
	if (/[a-z]/.test(password)) score += 1
	if (/[0-9]/.test(password)) score += 1
	if (/[^A-Za-z0-9]/.test(password)) score += 1

	if (score <= 2) return { label: 'Weak', className: 'weak', width: '33%' }
	if (score <= 4) return { label: 'Medium', className: 'medium', width: '66%' }
	return { label: 'Strong', className: 'strong', width: '100%' }
}

const Register = () => {
	const navigate = useNavigate()
	const { register, loading, error, setError } = useAuth()
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [role, setRole] = useState('translator')
	const [language, setLanguage] = useState('English')
	const [touched, setTouched] = useState({})
	const [message, setMessage] = useState('')
	const [clientError, setClientError] = useState('')

	const trimmedName = name.trim()
	const trimmedEmail = email.trim().toLowerCase()
	const trimmedLanguage = language.trim()
	const emailDomain = trimmedEmail.split('@')[1] || ''

	const nameError = trimmedName.length < 2 ? 'Name must be at least 2 characters.' : ''
	const emailError = !EMAIL_REGEX.test(trimmedEmail)
		? 'Enter a valid email address.'
		: BLOCKED_DOMAINS.has(emailDomain)
			? 'Disposable/fake domains are not allowed.'
			: ''
	const passwordError = password.length < 8 ? 'Password must be at least 8 characters.' : ''
	const confirmPasswordError = confirmPassword !== password ? 'Passwords do not match.' : ''
	const languageError = trimmedLanguage.length < 2 ? 'Language is required.' : ''
	const hasValidationError = Boolean(nameError || emailError || passwordError || confirmPasswordError || languageError)
	const passwordStrength = getPasswordStrength(password)

	const onSubmit = async (event) => {
		event.preventDefault()
		setTouched({
			name: true,
			email: true,
			password: true,
			confirmPassword: true,
			language: true
		})
		setClientError('')
		if (hasValidationError) {
			setClientError('Please fix the highlighted fields.')
			return
		}
		const result = await register({ name, email, password, role, language })
		if (result.ok) {
			setMessage('Registered successfully. Please wait for admin approval.')
			setTimeout(() => navigate('/login'), 1000)
		}
	}

	return (
		<div className="auth-page">
			<div className="auth-layout">
				<section className="auth-brand-panel">
					<p className="eyebrow">LMS AudioBook</p>
					<h1>Join The Publishing Workflow</h1>
					<p>Sign up with your real email, choose your role, and start once admin approves your account.</p>
				</section>

				<form className="auth-card auth-card-modern" onSubmit={onSubmit}>
					<h2>Create Account</h2>
					<p>Create your account and wait for admin approval.</p>

					<label htmlFor="name">Name</label>
					<input
						id="name"
						value={name}
						className={touched.name && nameError ? 'input-error' : ''}
						onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
						onChange={(event) => {
							setName(event.target.value)
							if (error) setError('')
						}}
						required
					/>
					{touched.name && nameError && <span className="field-error">{nameError}</span>}

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
							minLength={8}
							required
						/>
						<button type="button" className="toggle-pass" onClick={() => setShowPassword((prev) => !prev)}>
							{showPassword ? 'Hide' : 'Show'}
						</button>
					</div>
					{touched.password && passwordError && <span className="field-error">{passwordError}</span>}

					{password.length > 0 && (
						<div className="strength-wrap" aria-live="polite">
							<div className="strength-track">
								<span className={`strength-fill ${passwordStrength.className}`} style={{ width: passwordStrength.width }} />
							</div>
							<p>Password strength: <strong>{passwordStrength.label}</strong></p>
						</div>
					)}

					<label htmlFor="confirmPassword">Confirm Password</label>
					<div className="password-wrap">
						<input
							id="confirmPassword"
							type={showConfirmPassword ? 'text' : 'password'}
							value={confirmPassword}
							className={touched.confirmPassword && confirmPasswordError ? 'input-error' : ''}
							onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
							onChange={(event) => {
								setConfirmPassword(event.target.value)
								if (error) setError('')
							}}
							required
						/>
						<button type="button" className="toggle-pass" onClick={() => setShowConfirmPassword((prev) => !prev)}>
							{showConfirmPassword ? 'Hide' : 'Show'}
						</button>
					</div>
					{touched.confirmPassword && confirmPasswordError && <span className="field-error">{confirmPasswordError}</span>}

					<label htmlFor="role">Role</label>
					<select id="role" value={role} onChange={(event) => setRole(event.target.value)} required>
						<option value="translator">translator</option>
						<option value="checker">text checker</option>
						<option value="audio_checker">audio checker</option>
						<option value="recorder">recorder</option>
						<option value="spoc">spoc</option>
						<option value="regional_team">regional_team</option>
					</select>

					<label htmlFor="language">Language</label>
					<input
						id="language"
						value={language}
						className={touched.language && languageError ? 'input-error' : ''}
						onBlur={() => setTouched((prev) => ({ ...prev, language: true }))}
						onChange={(event) => {
							setLanguage(event.target.value)
							if (error) setError('')
						}}
						required
					/>
					{touched.language && languageError && <span className="field-error">{languageError}</span>}

					{clientError && <div className="error-box">{clientError}</div>}
					{error && <div className="error-box">{error}</div>}
					{message && <div className="ok-box">{message}</div>}

					<button type="submit" disabled={loading}>{loading ? 'Please wait...' : 'Register'}</button>

					<p className="auth-link">
						Already registered? <Link to="/login">Login</Link>
					</p>
				</form>
			</div>
		</div>
	)
}

export default Register
