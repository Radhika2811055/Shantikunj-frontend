import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

const normalizeUserRefId = (value) => {
	if (!value) return null
	if (typeof value === 'string') return value
	if (typeof value === 'object') return value._id || value.id || null
	return null
}

const formatRoleLabel = (role) => {
	if (!role) return 'Member'
	return role
		.toString()
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (char) => char.toUpperCase())
}

const getMemberInitials = (value) => {
	if (!value) return 'U'
	const parts = value
		.toString()
		.trim()
		.split(/\s+/)
		.filter(Boolean)
	if (!parts.length) return 'U'
	const first = parts[0]?.[0] || ''
	const second = parts[1]?.[0] || ''
	return `${first}${second || first}`.toUpperCase().slice(0, 2)
}

const roleSortOrder = {
	spoc: 1,
	translator: 2,
	checker: 3,
	recorder: 4,
	audio_checker: 5,
	member: 99
}

const TeamMembers = () => {
	const { user } = useAuth()
	const [members, setMembers] = useState([])
	const [books, setBooks] = useState([])
	const [notifications, setNotifications] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	const load = useCallback(async () => {
		setLoading(true)
		setError('')

		try {
			const [membersRes, booksRes, notifRes] = await Promise.all([
				api.get('/auth/language-members').catch(() => ({ data: { members: [] } })),
				api.get('/books').catch(() => ({ data: [] })),
				api.get('/notifications/my').catch(() => ({ data: { notifications: [] } }))
			])

			setMembers(Array.isArray(membersRes.data?.members) ? membersRes.data.members : [])
			setBooks(Array.isArray(booksRes.data) ? booksRes.data : [])
			setNotifications(Array.isArray(notifRes.data?.notifications) ? notifRes.data.notifications : [])
		} catch (loadError) {
			setError(loadError?.response?.data?.message || 'Team members could not be loaded. Please retry.')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		load()
	}, [load])

	const memberByRole = useMemo(() => {
		return members.reduce((acc, member) => {
			const role = member.role || 'member'
			if (!acc[role]) acc[role] = []
			acc[role].push(member)
			return acc
		}, {})
	}, [members])

	const roleEntries = useMemo(() => {
		return Object.entries(memberByRole).sort(([roleA], [roleB]) => {
			const orderA = roleSortOrder[roleA] ?? 50
			const orderB = roleSortOrder[roleB] ?? 50
			if (orderA !== orderB) return orderA - orderB
			return roleA.localeCompare(roleB)
		})
	}, [memberByRole])

	const memberWorkload = useMemo(() => {
		const nowMs = Date.now()
		const workloads = {}

		const bumpMember = (memberId, deadlineValue) => {
			if (!memberId) return
			if (!workloads[memberId]) workloads[memberId] = { assigned: 0, overdue: 0 }
			workloads[memberId].assigned += 1
			if (deadlineValue && new Date(deadlineValue).getTime() < nowMs) {
				workloads[memberId].overdue += 1
			}
		}

		books.forEach((book) => {
			;(book.languageVersions || []).forEach((version) => {
				if (version.language !== user?.language) return

				const stage = version.currentStage
				if (stage === 'translation') {
					bumpMember(normalizeUserRefId(version.assignedTranslator), version.translatorDeadline)
				}
				if (stage === 'checking') {
					bumpMember(normalizeUserRefId(version.assignedChecker), version.checkerDeadline)
				}
				if (stage === 'audio_generation') {
					bumpMember(normalizeUserRefId(version.assignedRecorder), version.recorderDeadline)
				}
				if (stage === 'audio_checking') {
					bumpMember(normalizeUserRefId(version.assignedAudioChecker), version.audioCheckerDeadline)
				}
				if (stage === 'spoc_review' || stage === 'final_verification') {
					bumpMember(user?.id, version.feedbackDeadline)
				}
			})
		})

		return workloads
	}, [books, user?.id, user?.language])

	const teamSummary = useMemo(() => {
		const overdueMembers = members.reduce((total, member) => {
			return total + ((memberWorkload[member._id]?.overdue || 0) > 0 ? 1 : 0)
		}, 0)

		return {
			totalMembers: members.length,
			totalRoles: roleEntries.length,
			overdueMembers
		}
	}, [members, memberWorkload, roleEntries.length])

	return (
		<Navbar notifications={notifications.filter((item) => !item.isRead).length}>
			<div className="team-members-page">
				<section className="team-members-hero">
					<div className="team-members-hero-copy">
						<h2>Team Members</h2>
						<p>View all approved language members for {user?.language || 'your language'}.</p>
					</div>
					<div className="team-members-kpi-row">
						<article className="team-kpi-card">
							<span>Total Members</span>
							<strong>{teamSummary.totalMembers}</strong>
						</article>
						<article className="team-kpi-card">
							<span>Roles</span>
							<strong>{teamSummary.totalRoles}</strong>
						</article>
						<article className="team-kpi-card">
							<span>Members With Overdue</span>
							<strong>{teamSummary.overdueMembers}</strong>
						</article>
					</div>
				</section>

				{error && (
					<section className="panel">
						<div className="alert-box danger">
							{error}
							<div className="row-actions">
								<button type="button" className="mini-btn" onClick={load}>Retry</button>
							</div>
						</div>
					</section>
				)}

				<section className="panel team-members-panel">
					<div className="team-panel-head">
						<h3>Language Team Members</h3>
						<span>{user?.language || 'Language'}</span>
					</div>
					{loading ? (
						<p>Loading...</p>
					) : roleEntries.length > 0 ? (
						<div className="member-role-grid">
							{roleEntries.map(([role, roleMembers]) => (
								<article className={`member-role-card role-${role.replace(/_/g, '-')}`} key={role}>
									<div className="member-role-head">
										<div>
											<h4>{formatRoleLabel(role)}</h4>
											<p>{roleMembers.length} {roleMembers.length === 1 ? 'member' : 'members'}</p>
										</div>
										<span className="member-role-badge">{formatRoleLabel(role)}</span>
									</div>
									<ul>
										{roleMembers.map((member) => {
											const assignedCount = memberWorkload[member._id]?.assigned || 0
											const overdueCount = memberWorkload[member._id]?.overdue || 0

											return (
												<li key={member._id} className="member-role-item">
													<div className="member-role-item-main">
														<span className="member-avatar">{getMemberInitials(member.name || member.email || 'U')}</span>
														<div>
															<p className="team-member-name">{member.name || '-'}</p>
															<p className="team-member-email">{member.email || '-'}</p>
														</div>
													</div>
													<div className="member-role-item-stats">
														<span className="member-stat-chip">Assigned {assignedCount}</span>
														<span className={`member-stat-chip ${overdueCount > 0 ? 'is-overdue' : 'is-clear'}`}>
															Overdue {overdueCount}
														</span>
													</div>
												</li>
											)
										})}
									</ul>
								</article>
							))}
						</div>
					) : (
						<p>No approved members found for your language yet.</p>
					)}
				</section>
			</div>
		</Navbar>
	)
}

export default TeamMembers
