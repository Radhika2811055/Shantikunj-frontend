import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const navByRole = {
	admin: [
		{ label: 'Dashboard', to: '/dashboard' },
		{ label: 'User Management', to: '/users' },
		{ label: 'Notifications', to: '/notifications' }
	],
	spoc: [
		{ label: 'Dashboard', to: '/dashboard' },
		{ label: 'Language SPOC', to: '/work' },
		{ label: 'Notifications', to: '/notifications' }
	],
	translator: [
		{ label: 'Translator Desk', to: '/work' },
		{ label: 'Work History', to: '/translator-history' },
		{ label: 'Notifications', to: '/notifications' }
	],
	checker: [
		{ label: 'Dashboard', to: '/dashboard' },
		{ label: 'My Claims', to: '/my-claims' },
		{ label: 'Work History', to: '/checker-history' },
		{ label: 'Notifications', to: '/notifications' }
	],
	audio_checker: [
		{ label: 'Dashboard', to: '/dashboard' },
		{ label: 'Audio Checker Desk', to: '/work' },
		{ label: 'Notifications', to: '/notifications' }
	],
	recorder: [
		{ label: 'Dashboard', to: '/dashboard' },
		{ label: 'Audio Creator', to: '/work' },
		{ label: 'Work History', to: '/recorder-history' },
		{ label: 'Notifications', to: '/notifications' },
		{ label: 'Audio Upload', to: '/audio-upload' },
		{ label: 'Recorder Feedback', to: '/recorder-feedback' }
	],
	regional_team: [
		{ label: 'Dashboard', to: '/dashboard' },
		{ label: 'Regional Team View', to: '/work' },
		{ label: 'Notifications', to: '/notifications' }
	]
}

const statsNavByRole = {
	admin: [{ label: 'Platform Analytics', to: '/statistics' }],
	spoc: [{ label: 'Language Analytics', to: '/statistics' }],
	translator: [{ label: 'My Productivity', to: '/statistics' }],
	checker: [],
	audio_checker: [],
	recorder: [],
	regional_team: [{ label: 'Feedback Trends', to: '/statistics' }]
}

const rolesWithStatistics = new Set(['admin', 'spoc', 'translator', 'regional_team'])

const teamNavByRole = {
	spoc: [{ label: 'Team Members', to: '/team-members' }]
}

const managementNavByRole = {
	admin: [{ label: 'Book Management', to: '/book-management' }]
}

const translatorToolsNavByRole = {
	translator: [
		{ label: 'Feedback & Reassignment', to: '/translator-feedback' },
		{ label: 'File Upload', to: '/translator-upload' }
	]
}

const staticSearchLinks = [
	{ key: 'work', label: 'Open Work Queue', meta: 'Tasks and claims', to: '/work' },
	{ key: 'stats', label: 'Open Statistics', meta: 'Analytics and progress', to: '/statistics' },
	{ key: 'notifications', label: 'Open Notifications', meta: 'Recent alerts', to: '/notifications' }
]

const Navbar = ({ children, notifications = 0 }) => {
	const navigate = useNavigate()
	const { user, logout } = useAuth()
	const { isDark, toggleTheme } = useTheme()
	const searchRef = useRef(null)
	const [now, setNow] = useState(() => new Date())
	const [query, setQuery] = useState('')
	const [searching, setSearching] = useState(false)
	const [results, setResults] = useState([])
	const [showDropdown, setShowDropdown] = useState(false)
	const navItems = navByRole[user?.role] || [{ label: 'Dashboard', to: '/dashboard' }]
	const statsItems = statsNavByRole[user?.role] || [{ label: 'Statistics', to: '/statistics' }]
	const teamItems = teamNavByRole[user?.role] || []
	const managementItems = managementNavByRole[user?.role] || []
	const translatorToolItems = translatorToolsNavByRole[user?.role] || []
	const searchTerm = query.trim().toLowerCase()
	const roleLabel = user?.role === 'checker'
		? 'Text Checker'
		: (user?.role || 'User').replaceAll('_', ' ')
	const displayName = (user?.name || 'User').trim()
	const firstName = displayName.split(/\s+/)[0] || displayName
	const greeting = useMemo(() => {
		const hour = now.getHours()
		if (hour < 12) return 'Good morning'
		if (hour < 17) return 'Good afternoon'
		if (hour < 21) return 'Good evening'
		return 'Good night'
	}, [now])

	const quickLinks = useMemo(() => {
		const allowed = staticSearchLinks.filter((item) => {
			if (item.to === '/work') return ['spoc', 'translator', 'checker', 'audio_checker', 'recorder', 'regional_team'].includes(user?.role)
			if (item.to === '/statistics') return rolesWithStatistics.has(user?.role)
			return true
		})

		if (!searchTerm) return []

		return allowed
			.filter((item) => `${item.label} ${item.meta}`.toLowerCase().includes(searchTerm))
			.map((item) => ({
				id: `quick-${item.key}`,
				title: item.label,
				meta: item.meta,
				to: item.to
			}))
	}, [searchTerm, user?.role])

	useEffect(() => {
		const onOutsideClick = (event) => {
			if (!searchRef.current?.contains(event.target)) {
				setShowDropdown(false)
			}
		}

		document.addEventListener('mousedown', onOutsideClick)
		return () => document.removeEventListener('mousedown', onOutsideClick)
	}, [])

	useEffect(() => {
		const timer = setInterval(() => {
			setNow(new Date())
		}, 60 * 1000)

		return () => clearInterval(timer)
	}, [])

	useEffect(() => {
		if (!searchTerm) {
			setResults([])
			setSearching(false)
			return
		}

		let cancelled = false
		setSearching(true)

		const timer = setTimeout(async () => {
			try {
				const [booksRes, usersRes] = await Promise.all([
					api.get('/books').catch(() => ({ data: [] })),
					user?.role === 'admin'
						? api.get('/admin/users/all').catch(() => ({ data: [] }))
						: Promise.resolve({ data: [] })
				])

				const books = Array.isArray(booksRes.data) ? booksRes.data : []
				const matchedBooks = books
					.filter((book) => {
						const languages = (book.languageVersions || []).map((version) => version.language).join(' ')
						const haystack = `${book.title || ''} ${book.bookNumber || ''} ${languages}`.toLowerCase()
						return haystack.includes(searchTerm)
					})
					.slice(0, 6)
					.map((book) => ({
						id: `book-${book._id}`,
						title: book.title,
						meta: `Book #${book.bookNumber || '-'} • ${(book.languageVersions || []).length} language versions`,
						to: user?.role === 'admin' ? '/book-management' : '/work'
					}))

				const users = Array.isArray(usersRes.data) ? usersRes.data : []
				const matchedUsers = users
					.filter((member) => {
						const haystack = `${member.name || ''} ${member.email || ''} ${member.role || ''} ${member.language || ''}`.toLowerCase()
						return haystack.includes(searchTerm)
					})
					.slice(0, 4)
					.map((member) => ({
						id: `user-${member._id}`,
						title: member.name || member.email || 'User',
						meta: `${member.email || '-'} • ${member.role || '-'} • ${member.language || '-'}`,
						to: '/users'
					}))

				if (!cancelled) {
					setResults([...matchedBooks, ...matchedUsers, ...quickLinks].slice(0, 10))
				}
			} finally {
				if (!cancelled) setSearching(false)
			}
		}, 220)

		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [searchTerm, user?.role, quickLinks])

	const openSearchResult = (target) => {
		if (!target?.to) return
		navigate(target.to)
		setQuery('')
		setResults([])
		setShowDropdown(false)
	}

	const onSearchSubmit = (event) => {
		event.preventDefault()
		if (results.length > 0) {
			openSearchResult(results[0])
			return
		}

		if (searchTerm.includes('notification')) {
			openSearchResult({ to: '/notifications' })
		} else if (searchTerm.includes('stat') && rolesWithStatistics.has(user?.role)) {
			openSearchResult({ to: '/statistics' })
		}
	}

	return (
		<div className="app-shell">
			<aside className="sidebar">
				<div className="brand">
					<div>
						<h1>LMS AudioBook</h1>
						<p>LMS Production Hub</p>
					</div>
				</div>

				<nav className="side-nav">
					{navItems.map((item) => (
						<NavLink
							key={`${item.label}-${item.to}`}
							to={item.to}
							className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
						>
							{item.label}
						</NavLink>
					))}
				</nav>

				{statsItems.length > 0 && (
					<div className="side-section">
						<p className="side-section-title">Statistics</p>
						<nav className="side-nav side-nav-compact">
							{statsItems.map((item) => (
								<NavLink
									key={`${item.label}-${item.to}`}
									to={item.to}
									className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
								>
									{item.label}
								</NavLink>
							))}
						</nav>
					</div>
				)}

				{managementItems.length > 0 && (
					<div className="side-section">
						<p className="side-section-title">Management</p>
						<nav className="side-nav side-nav-compact">
							{managementItems.map((item) => (
								<NavLink
									key={`${item.label}-${item.to}`}
									to={item.to}
									className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
								>
									{item.label}
								</NavLink>
							))}
						</nav>
					</div>
				)}

				{translatorToolItems.length > 0 && (
					<div className="side-section">
						<p className="side-section-title">Translator Tools</p>
						<nav className="side-nav side-nav-compact">
							{translatorToolItems.map((item) => (
								<NavLink
									key={`${item.label}-${item.to}`}
									to={item.to}
									className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
								>
									{item.label}
								</NavLink>
							))}
						</nav>
					</div>
				)}

				{teamItems.length > 0 && (
					<div className="side-section">
						<p className="side-section-title">Team Members</p>
						<nav className="side-nav side-nav-compact">
							{teamItems.map((item) => (
								<NavLink
									key={`${item.label}-${item.to}`}
									to={item.to}
									className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
								>
									{item.label}
								</NavLink>
							))}
						</nav>
					</div>
				)}

			</aside>

			<main className="main-panel">
				<header className="topbar">
					{user?.role === 'checker' ? (
						<div className="topbar-intro" aria-live="polite">
							<h2>{greeting}, {firstName}</h2>
							<p>{roleLabel} · Hindi -&gt; {user?.language || 'Not set'}</p>
						</div>
					) : (
						<form className="search-wrap" ref={searchRef} onSubmit={onSearchSubmit}>
							<input
								className="search"
								placeholder="Search books, users, languages..."
								value={query}
								onFocus={() => setShowDropdown(true)}
								onChange={(event) => {
									setQuery(event.target.value)
									setShowDropdown(true)
								}}
							/>

							{showDropdown && query.trim().length > 0 && (
								<div className="search-dropdown">
									{searching ? (
										<p className="search-empty">Searching...</p>
									) : results.length === 0 ? (
										<p className="search-empty">No matches found.</p>
									) : (
										results.map((result) => (
											<button
												key={result.id}
												type="button"
												className="search-result"
												onMouseDown={(event) => event.preventDefault()}
												onClick={() => openSearchResult(result)}
											>
												<strong>{result.title}</strong>
												<span>{result.meta}</span>
											</button>
										))
									)}
								</div>
							)}
						</form>
					)}

					<div className="top-actions">
						<button
							type="button"
							className="theme-toggle"
							onClick={toggleTheme}
							aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
							title={isDark ? 'Light Mode' : 'Dark Mode'}
						>
							{isDark ? '☀' : '☾'}
						</button>

						<button
							type="button"
							className="notif-btn"
							onClick={() => navigate('/notifications')}
							aria-label="Open notifications"
							title="Notifications"
						>
							<svg viewBox="0 0 24 24" className="notif-icon" aria-hidden="true">
								<path d="M12 3a5 5 0 0 0-5 5v2.5c0 .8-.3 1.5-.8 2.1L5 14h14l-1.2-1.4c-.5-.6-.8-1.3-.8-2.1V8a5 5 0 0 0-5-5z" />
								<path d="M9.8 16a2.2 2.2 0 0 0 4.4 0" />
							</svg>
							{notifications > 0 && <span className="notif-count">{notifications}</span>}
						</button>

						<div className="profile-chip">
							<div className="avatar">{(user?.name || 'U').slice(0, 1).toUpperCase()}</div>
							<div>
								<strong>{user?.name || 'User'}</strong>
								<p>{user?.email || ''}</p>
							</div>
						</div>

						<button type="button" className="ghost" onClick={logout}>Logout</button>
					</div>
				</header>

				<div className="content-area">{children}</div>
			</main>
		</div>
	)
}

export default Navbar
