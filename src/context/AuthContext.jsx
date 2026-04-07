/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getApiErrorMessage } from '../api/errorParser'
import { authService } from '../api/services'

const AuthContext = createContext(null)

const decodeJwtPayload = (token) => {
	try {
		const payload = String(token || '').split('.')[1]
		if (!payload) return null

		const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
		const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
		return JSON.parse(atob(padded))
	} catch {
		return null
	}
}

const normalizeUserWithToken = (rawUser, token) => {
	if (!rawUser) return null

	const payload = decodeJwtPayload(token)
	const resolvedId = rawUser.id && rawUser.id !== 'google-user'
		? rawUser.id
		: (rawUser._id || payload?.userId || rawUser.id)

	return {
		...rawUser,
		id: resolvedId || rawUser.id || null,
		role: rawUser.role || payload?.role || null
	}
}

const getStoredUser = () => {
	try {
		const raw = localStorage.getItem('user')
		return raw ? JSON.parse(raw) : null
	} catch {
		return null
	}
}

export const AuthProvider = ({ children }) => {
	const initialToken = localStorage.getItem('token')
	const [user, setUser] = useState(normalizeUserWithToken(getStoredUser(), initialToken))
	const [token, setToken] = useState(initialToken)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		if (!user || !token) return

		const normalizedUser = normalizeUserWithToken(user, token)
		if (!normalizedUser?.id || normalizedUser.id === user.id) return

		setUser(normalizedUser)
		localStorage.setItem('user', JSON.stringify(normalizedUser))
	}, [user, token])

	useEffect(() => {
		if (!token) return

		let cancelled = false

		const hydrateProfile = async () => {
			try {
				const response = await authService.me()
				const profile = response?.data
				if (!profile || cancelled) return

				setUser((prev) => {
					const merged = normalizeUserWithToken({
						...(prev || {}),
						id: profile.id || profile._id || prev?.id || prev?._id || null,
						name: profile.name || prev?.name || '',
						email: profile.email || prev?.email || '',
						role: profile.role || prev?.role || null,
						language: profile.language || prev?.language || null
					}, token)

					localStorage.setItem('user', JSON.stringify(merged))
					return merged
				})
			} catch {
				// Keep existing local session if profile hydration fails.
			}
		}

		hydrateProfile()

		return () => {
			cancelled = true
		}
	}, [token])

	const login = async (email, password) => {
		setLoading(true)
		setError('')
		try {
			const { data } = await authService.login({ email, password })
			setUser(data.user)
			setToken(data.token)
			localStorage.setItem('token', data.token)
			localStorage.setItem('user', JSON.stringify(data.user))
			return { ok: true, user: data.user }
		} catch (err) {
			const msg = getApiErrorMessage(err, 'Login failed')
			setError(msg)
			return { ok: false, message: msg }
		} finally {
			setLoading(false)
		}
	}

	const register = async (payload) => {
		setLoading(true)
		setError('')
		try {
			await authService.register(payload)
			return { ok: true }
		} catch (err) {
			const msg = getApiErrorMessage(err, 'Registration failed')
			setError(msg)
			return { ok: false, message: msg }
		} finally {
			setLoading(false)
		}
	}

	const logout = () => {
		setUser(null)
		setToken(null)
		localStorage.removeItem('token')
		localStorage.removeItem('user')
	}

	const completeSessionFromToken = (oauthToken, oauthUser) => {
		const normalizedUser = normalizeUserWithToken(oauthUser, oauthToken)
		setToken(oauthToken)
		setUser(normalizedUser)
		localStorage.setItem('token', oauthToken)
		localStorage.setItem('user', JSON.stringify(normalizedUser))
	}

	const value = useMemo(() => ({
		user,
		token,
		loading,
		error,
		isAuthenticated: Boolean(token && user),
		login,
		register,
		logout,
		completeSessionFromToken,
		setError
	}), [user, token, loading, error])

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
	const context = useContext(AuthContext)
	if (!context) {
		throw new Error('useAuth must be used inside AuthProvider')
	}
	return context
}
