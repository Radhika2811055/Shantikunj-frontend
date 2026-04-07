import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

const pipelineStages = [
	{ key: 'translation', label: 'Translation' },
	{ key: 'checking', label: 'Text Vetting' },
	{ key: 'spoc_review', label: 'SPOC Review' },
	{ key: 'audio_generation', label: 'Audio Generation' },
	{ key: 'audio_checking', label: 'Audio Vetting' },
	{ key: 'final_verification', label: 'Final Verification' },
	{ key: 'published', label: 'Published' }
]

const adminLanguageReportStages = [
	{ key: 'translation', label: 'Translation' },
	{ key: 'checking', label: 'Text Vetting' },
	{ key: 'spoc_review', label: 'SPOC Review' },
	{ key: 'audio_generation', label: 'Audio Generation' },
	{ key: 'audio_checking', label: 'Audio Review' },
	{ key: 'final_verification', label: 'Admin Review' }
]

const spocStageLabels = {
	translation: 'Translation',
	checking: 'Text Vetting',
	spoc_review: 'SPOC Review',
	audio_generation: 'Audio Generation',
	audio_checking: 'Audio Vetting',
	final_verification: 'Final Verification',
	published: 'Published'
}

const spocStageColors = {
	translation: 'linear-gradient(180deg, #2f80ed, #56ccf2)',
	checking: 'linear-gradient(180deg, #f2994a, #f2c94c)',
	spoc_review: 'linear-gradient(180deg, #9b51e0, #bb6bd9)',
	audio_generation: 'linear-gradient(180deg, #27ae60, #6fcf97)',
	audio_checking: 'linear-gradient(180deg, #eb5757, #ff8a80)',
	final_verification: 'linear-gradient(180deg, #2d9cdb, #56ccf2)',
	published: 'linear-gradient(180deg, #219653, #27ae60)'
}

const formatRelativeTime = (value) => {
	if (!value) return 'just now'
	const now = Date.now()
	const time = new Date(value).getTime()
	const diffMs = Math.max(0, now - time)
	const mins = Math.floor(diffMs / (1000 * 60))
	if (mins < 1) return 'just now'
	if (mins < 60) return `${mins} min ago`
	const hours = Math.floor(mins / 60)
	if (hours < 24) return `${hours} hr ago`
	const days = Math.floor(hours / 24)
	return `${days} day${days > 1 ? 's' : ''} ago`
}

const stageDeadlineField = {
	translation: 'translatorDeadline',
	checking: 'checkerDeadline',
	audio_generation: 'recorderDeadline',
	audio_checking: 'audioCheckerDeadline',
	spoc_review: 'feedbackDeadline',
	final_verification: 'feedbackDeadline'
}

const normalizeUserRefId = (value) => {
	if (!value) return null
	if (typeof value === 'string') return value
	if (typeof value === 'object') return value._id || value.id || null
	return null
}

const resolveAssignee = (rawUserRef, memberLookup = {}) => {
	const resolvedId = normalizeUserRefId(rawUserRef)
	const userObj = rawUserRef && typeof rawUserRef === 'object' ? rawUserRef : null
	const member = resolvedId ? memberLookup[String(resolvedId)] : null
	const name = userObj?.name || member?.name || '-'
	const email = userObj?.email || member?.email || ''

	return {
		id: resolvedId,
		name,
		email,
		label: name === '-' ? 'Unassigned' : email ? `${name} (${email})` : name
	}
}

const AdminDashboard = () => {
	const { user } = useAuth()
	const [books, setBooks] = useState([])
	const [detailedBooks, setDetailedBooks] = useState([])
	const [languageMembers, setLanguageMembers] = useState([])
	const [assigned, setAssigned] = useState([])
	const [notifications, setNotifications] = useState([])
	const [usersCount, setUsersCount] = useState(0)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [selectedStage, setSelectedStage] = useState('all')
	const [selectedAdminLanguage, setSelectedAdminLanguage] = useState('')
	const [urgentOnlyDeadlines, setUrgentOnlyDeadlines] = useState(false)
	const [urgentOnlyActivity, setUrgentOnlyActivity] = useState(false)

	const load = useCallback(async () => {
			setLoading(true)
			setError('')
			try {
				const [booksRes, assignedRes, notifRes] = await Promise.all([
					api.get('/books'),
					api.get('/books/my-assignments').catch(() => ({ data: [] })),
					api.get('/notifications/my').catch(() => ({ data: { notifications: [] } }))
				])

				const booksList = Array.isArray(booksRes.data) ? booksRes.data : []
				setBooks(booksList)
				setAssigned(Array.isArray(assignedRes.data) ? assignedRes.data : [])
				setNotifications(Array.isArray(notifRes.data.notifications) ? notifRes.data.notifications : [])

				const ids = booksList.map((book) => book._id)
				const detailResponses = await Promise.all(
					ids.map((id) => api.get(`/books/${id}`).catch(() => null))
				)

				setDetailedBooks(detailResponses.map((resp) => resp?.data).filter(Boolean))

				if (user?.role === 'spoc') {
					const membersRes = await api.get('/auth/language-members').catch(() => ({ data: { members: [] } }))
					setLanguageMembers(Array.isArray(membersRes.data?.members) ? membersRes.data.members : [])
				} else {
					setLanguageMembers([])
				}

				if (user?.role === 'admin') {
					const usersRes = await api.get('/admin/users/all').catch(() => ({ data: [] }))
					setUsersCount(Array.isArray(usersRes.data) ? usersRes.data.length : 0)
				}
			} catch (loadError) {
				setError(loadError?.response?.data?.message || 'Dashboard data could not be loaded. Please retry.')
			} finally {
				setLoading(false)
			}
		}, [user?.role])

	useEffect(() => {
		load()
	}, [load])

	const sourceBooks = detailedBooks.length > 0 ? detailedBooks : books

	const adminLanguageOptions = useMemo(() => {
		if (user?.role !== 'admin') return []
		const activeLanguages = new Set()
		const fallbackLanguages = new Set()

		sourceBooks.forEach((book) => {
			;(book.languageVersions || []).forEach((version) => {
				const language = String(version.language || '').trim()
				if (!language) return

				fallbackLanguages.add(language)

				const hasAssignment = Boolean(
					version.assignedTranslator ||
					version.assignedChecker ||
					version.assignedRecorder ||
					version.assignedAudioChecker
				)
				const hasProgress =
					version.currentStage !== 'translation' ||
					version.textStatus !== 'not_started' ||
					version.audioStatus !== 'not_started'
				const hasFeedback = Boolean(String(version.feedback || '').trim())

				if (hasAssignment || hasProgress || hasFeedback) {
					activeLanguages.add(language)
				}
			})
		})

		const languagesToShow = activeLanguages.size > 0 ? [...activeLanguages] : [...fallbackLanguages]
		return languagesToShow.sort((a, b) => a.localeCompare(b))
	}, [sourceBooks, user?.role])

	useEffect(() => {
		if (user?.role !== 'admin') return
		if (adminLanguageOptions.length === 0) {
			setSelectedAdminLanguage('')
			return
		}

		setSelectedAdminLanguage((prev) => (
			prev && adminLanguageOptions.includes(prev)
				? prev
				: adminLanguageOptions[0]
		))
	}, [adminLanguageOptions, user?.role])

	const adminLanguageReport = useMemo(() => {
		if (user?.role !== 'admin' || !selectedAdminLanguage) return null

		const stageCounts = Object.fromEntries(
			adminLanguageReportStages.map((stage) => [stage.key, 0])
		)
		const spocNames = new Map()

		sourceBooks.forEach((book) => {
			;(book.languageVersions || []).forEach((version) => {
				if (version.language !== selectedAdminLanguage) return
				if (stageCounts[version.currentStage] !== undefined) {
					stageCounts[version.currentStage] += 1
				}

				const spocRef = version.spoc
				if (!spocRef || typeof spocRef !== 'object') return
				const spocName = spocRef.name || ''
				if (!spocName) return
				const spocId = spocRef._id || spocRef.id || spocName
				spocNames.set(String(spocId), spocName)
			})
		})

		return {
			spocLabel: spocNames.size > 0 ? [...spocNames.values()].join(', ') : 'Not assigned',
			stages: adminLanguageReportStages.map((stage) => ({
				...stage,
				count: stageCounts[stage.key] || 0
			}))
		}
	}, [selectedAdminLanguage, sourceBooks, user?.role])

	const stats = useMemo(() => {
		const totalBooks = books.length
		const languages = new Set()
		sourceBooks.forEach((book) => {
			;(book.languageVersions || []).forEach((version) => languages.add(version.language))
		})

		let completion = books.length
			? Math.round((books.filter((book) => book.status === 'completed').length / books.length) * 100)
			: 0

		if (user?.role === 'checker') {
			const publishedBooks = sourceBooks.filter((book) => (
				(book.languageVersions || []).some((version) => (
					version.currentStage === 'published' || version.audioStatus === 'published'
				))
			)).length

			completion = totalBooks
				? Math.round((publishedBooks / totalBooks) * 100)
				: 0
		} else if (user?.role !== 'admin') {
			const scopedVersions = sourceBooks
				.map((book) => (book.languageVersions || []).find((version) => version.language === user?.language))
				.filter(Boolean)

			const publishedScoped = scopedVersions.filter((version) => (
				version.currentStage === 'published' || version.audioStatus === 'published'
			)).length

			completion = scopedVersions.length
				? Math.round((publishedScoped / scopedVersions.length) * 100)
				: 0
		}

		return {
			totalBooks,
			languages: languages.size,
			users: user?.role === 'admin' ? usersCount : assigned.length,
			completion
		}
	}, [sourceBooks, books, usersCount, assigned.length, user?.role, user?.language])

	const stageCounts = useMemo(() => {
		const counts = {
			translation: 0,
			checking: 0,
			spoc_review: 0,
			audio_generation: 0,
			audio_checking: 0,
			final_verification: 0,
			published: 0
		}

		const mapStageToPipelineBucket = (version) => {
			if (!version) return null
			if (version.currentStage === 'published' || version.audioStatus === 'published') return 'published'
			if (counts[version.currentStage] !== undefined) return version.currentStage
			return null
		}

		const shouldCountPipelineStage = (version, stageKey) => {
			if (!version || !stageKey) return false
			if (user?.role === 'recorder') return true
			if (stageKey !== 'translation') return true

			// For operational dashboards, translation should reflect only assigned work.
			return Boolean(normalizeUserRefId(version.assignedTranslator))
		}

		const hasCurrentOrPastTranslationAssignment = (version) => {
			if (!version) return false

			const hasTranslatorAssigned = Boolean(normalizeUserRefId(version.assignedTranslator))
			const hasSubmittedTextLink =
				Boolean(String(version.textFileUrl || '').trim()) ||
				(Array.isArray(version.textFileUrls) && version.textFileUrls.some((item) => String(item || '').trim()))

			const hasTranslationTrail =
				Boolean(version.translatorDeadline) ||
				hasSubmittedTextLink ||
				Number(version.reassignmentCount || 0) > 0

			return hasTranslatorAssigned || hasTranslationTrail
		}

		if (user?.role !== 'admin') {
			let checkerTranslationAssignedCount = 0

			sourceBooks.forEach((book) => {
				const scopedVersion = (book.languageVersions || []).find((version) => version.language === user?.language)
				if (user?.role === 'checker' && hasCurrentOrPastTranslationAssignment(scopedVersion)) {
					checkerTranslationAssignedCount += 1
				}

				const pipelineStage = mapStageToPipelineBucket(scopedVersion)
				if (pipelineStage && shouldCountPipelineStage(scopedVersion, pipelineStage)) {
					counts[pipelineStage] += 1
				}
			})

			if (user?.role === 'checker') {
				counts.translation = checkerTranslationAssignedCount
			}

			return counts
		}

		sourceBooks.forEach((book) => {
			;(book.languageVersions || []).forEach((version) => {
				const pipelineStage = mapStageToPipelineBucket(version)
				if (pipelineStage) counts[pipelineStage] += 1
			})
		})

		return counts
	}, [sourceBooks, user?.language, user?.role])

	const memberLookup = useMemo(() => {
		if (user?.role !== 'spoc') return {}
		return languageMembers.reduce((acc, member) => {
			if (member?._id) {
				acc[String(member._id)] = {
					name: member.name || '-',
					email: member.email || ''
				}
			}
			return acc
		}, {})
	}, [languageMembers, user?.role])

	const spocVersions = useMemo(() => {
		if (user?.role !== 'spoc') return []
		const rows = []

		sourceBooks.forEach((book) => {
			;(book.languageVersions || []).forEach((version) => {
				if (version.language !== user?.language) return
				const translatorInfo = resolveAssignee(version.assignedTranslator, memberLookup)
				const checkerInfo = resolveAssignee(version.assignedChecker, memberLookup)
				const recorderInfo = resolveAssignee(version.assignedRecorder, memberLookup)
				const audioCheckerInfo = resolveAssignee(version.assignedAudioChecker, memberLookup)
				const spocInfo = resolveAssignee(
					version.spoc || {
						id: user?.id,
						name: user?.name,
						email: user?.email
					},
					memberLookup
				)
				rows.push({
					bookId: book._id,
					title: book.title,
					language: version.language,
					stage: version.currentStage,
					textStatus: version.textStatus,
					audioStatus: version.audioStatus,
					translatorDeadline: version.translatorDeadline,
					checkerDeadline: version.checkerDeadline,
					recorderDeadline: version.recorderDeadline,
					audioCheckerDeadline: version.audioCheckerDeadline,
					feedbackDeadline: version.feedbackDeadline,
					updatedAt: version.updatedAt,
					textRejectionCount: version.textRejectionCount || 0,
					audioRejectionCount: version.audioRejectionCount || 0,
					isBlockedBySpoc: Boolean(version.isBlockedBySpoc),
					assignedTranslatorId: translatorInfo.id,
					assignedTranslator: translatorInfo.name,
					assignedTranslatorInfo: translatorInfo,
					assignedCheckerId: checkerInfo.id,
					assignedChecker: checkerInfo.name,
					assignedCheckerInfo: checkerInfo,
					assignedRecorderId: recorderInfo.id,
					assignedRecorder: recorderInfo.name,
					assignedRecorderInfo: recorderInfo,
					assignedAudioCheckerId: audioCheckerInfo.id,
					assignedAudioChecker: audioCheckerInfo.name,
					assignedAudioCheckerInfo: audioCheckerInfo,
					spocInfo,
					versionId: version._id
				})
			})
		})

		return rows
	}, [sourceBooks, user?.role, user?.language, user?.id, user?.name, user?.email, memberLookup])

	const spocSummary = useMemo(() => {
		if (user?.role !== 'spoc') return null

		const total = spocVersions.length
		const textReviewPending = spocVersions.filter((v) => (
			v.stage === 'spoc_review' && v.textStatus === 'checking_submitted'
		)).length
		const audioFinalPending = spocVersions.filter((v) => v.stage === 'final_verification' && v.audioStatus === 'audio_checking_submitted').length
		const blocked = spocVersions.filter((v) => v.isBlockedBySpoc).length
		const published = spocVersions.filter((v) => v.audioStatus === 'published' || v.stage === 'published').length
		const completion = total ? Math.round((published / total) * 100) : 0

		return { total, textReviewPending, audioFinalPending, blocked, published, completion }
	}, [spocVersions, user?.role])

	const spocAssignedBooks = useMemo(() => {
		if (user?.role !== 'spoc') return []

		const stageReached = (currentStage, targetStage) => {
			const order = ['translation', 'checking', 'spoc_review', 'audio_generation', 'audio_checking', 'final_verification', 'published']
			const currentIndex = order.indexOf(currentStage)
			const targetIndex = order.indexOf(targetStage)
			if (currentIndex === -1 || targetIndex === -1) return false
			return currentIndex >= targetIndex
		}

		const getStageProcessDetails = (item, stageKey) => {
			switch (stageKey) {
				case 'translation': {
					const actor = item.assignedTranslatorInfo
					const hasStarted = item.textStatus !== 'not_started'
					if (!hasStarted || !actor?.id) return null
					const isCompleted = item.textStatus !== 'translation_in_progress' || stageReached(item.stage, 'checking')
					return { actor, isCompleted }
				}
				case 'checking': {
					const actor = item.assignedCheckerInfo
					const hasStarted = ['checking_in_progress', 'checking_submitted', 'spoc_review', 'text_approved'].includes(item.textStatus) || stageReached(item.stage, 'spoc_review')
					if (!hasStarted || !actor?.id) return null
					const isCompleted = ['checking_submitted', 'spoc_review', 'text_approved'].includes(item.textStatus) || stageReached(item.stage, 'spoc_review')
					return { actor, isCompleted }
				}
				case 'spoc_review': {
					const actor = item.spocInfo
					const hasStarted = stageReached(item.stage, 'spoc_review') || item.textStatus === 'text_approved'
					if (!hasStarted || !actor?.id) return null
					const isCompleted = item.textStatus === 'text_approved' || stageReached(item.stage, 'audio_generation')
					return { actor, isCompleted }
				}
				case 'audio_generation': {
					const actor = item.assignedRecorderInfo
					const hasStarted = item.audioStatus !== 'not_started' || stageReached(item.stage, 'audio_generation')
					if (!hasStarted || !actor?.id) return null
					const isCompleted = ['audio_submitted', 'audio_checking_in_progress', 'audio_checking_submitted', 'audio_approved', 'published'].includes(item.audioStatus) || stageReached(item.stage, 'audio_checking')
					return { actor, isCompleted }
				}
				case 'audio_checking': {
					const actor = item.assignedAudioCheckerInfo
					const hasStarted = ['audio_checking_in_progress', 'audio_checking_submitted', 'audio_approved', 'published'].includes(item.audioStatus) || stageReached(item.stage, 'audio_checking')
					if (!hasStarted || !actor?.id) return null
					const isCompleted = ['audio_checking_submitted', 'audio_approved', 'published'].includes(item.audioStatus) || stageReached(item.stage, 'final_verification')
					return { actor, isCompleted }
				}
				case 'final_verification': {
					const actor = item.spocInfo
					const hasStarted = stageReached(item.stage, 'final_verification') || ['audio_approved', 'published'].includes(item.audioStatus)
					if (!hasStarted || !actor?.id) return null
					const isCompleted = item.stage === 'published' || item.audioStatus === 'published'
					return { actor, isCompleted }
				}
				case 'published': {
					const actor = item.spocInfo
					if (item.stage !== 'published' || !actor?.id) return null
					return { actor, isCompleted: true }
				}
				default:
					return null
			}
		}

		if (selectedStage !== 'all') {
			return spocVersions
				.map((item) => {
					const details = getStageProcessDetails(item, selectedStage)
					if (!details) return null

					return {
						...item,
						stage: selectedStage,
						stageLabel: spocStageLabels[selectedStage] || selectedStage.replaceAll('_', ' '),
						currentOwnerId: details.actor.id,
						currentOwnerName: details.actor.name || '-',
						currentOwnerEmail: details.actor.email || '',
						processState: details.isCompleted ? 'completed' : 'in_progress'
					}
				})
				.filter(Boolean)
				.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
		}

		return spocVersions
			.filter((item) => item.stage === 'spoc_review' && item.textStatus === 'checking_submitted')
			.map((item) => ({
				...item,
				stage: 'spoc_review',
				stageLabel: spocStageLabels.spoc_review,
				currentOwnerId: item.spocInfo?.id || '',
				currentOwnerName: item.spocInfo?.name || '-',
				currentOwnerEmail: item.spocInfo?.email || '',
				processState: 'in_progress'
			}))
			.filter((item) => Boolean(item.currentOwnerId))
			.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
	}, [spocVersions, user?.role, selectedStage])

	const spocStageBreakdown = useMemo(() => {
		if (user?.role !== 'spoc') return []

		const stageOrder = [
			'translation',
			'checking',
			'spoc_review',
			'audio_generation',
			'audio_checking',
			'final_verification',
			'published'
		]

		const stageReached = (currentStage, targetStage) => {
			const order = ['translation', 'checking', 'spoc_review', 'audio_generation', 'audio_checking', 'final_verification', 'published']
			const currentIndex = order.indexOf(currentStage)
			const targetIndex = order.indexOf(targetStage)
			if (currentIndex === -1 || targetIndex === -1) return false
			return currentIndex >= targetIndex
		}

		const getStageProcessDetails = (item, stageKey) => {
			switch (stageKey) {
				case 'translation': {
					const actor = item.assignedTranslatorInfo
					const hasStarted = item.textStatus !== 'not_started'
					if (!hasStarted || !actor?.id) return null
					const isCompleted = item.textStatus !== 'translation_in_progress' || stageReached(item.stage, 'checking')
					return { actor, isCompleted }
				}
				case 'checking': {
					const actor = item.assignedCheckerInfo
					const hasStarted = ['checking_in_progress', 'checking_submitted', 'spoc_review', 'text_approved'].includes(item.textStatus) || stageReached(item.stage, 'spoc_review')
					if (!hasStarted || !actor?.id) return null
					const isCompleted = ['checking_submitted', 'spoc_review', 'text_approved'].includes(item.textStatus) || stageReached(item.stage, 'spoc_review')
					return { actor, isCompleted }
				}
				case 'spoc_review': {
					const actor = item.spocInfo
					const hasStarted = stageReached(item.stage, 'spoc_review') || item.textStatus === 'text_approved'
					if (!hasStarted || !actor?.id) return null
					const isCompleted = item.textStatus === 'text_approved' || stageReached(item.stage, 'audio_generation')
					return { actor, isCompleted }
				}
				case 'audio_generation': {
					const actor = item.assignedRecorderInfo
					const hasStarted = item.audioStatus !== 'not_started' || stageReached(item.stage, 'audio_generation')
					if (!hasStarted || !actor?.id) return null
					const isCompleted = ['audio_submitted', 'audio_checking_in_progress', 'audio_checking_submitted', 'audio_approved', 'published'].includes(item.audioStatus) || stageReached(item.stage, 'audio_checking')
					return { actor, isCompleted }
				}
				case 'audio_checking': {
					const actor = item.assignedAudioCheckerInfo
					const hasStarted = ['audio_checking_in_progress', 'audio_checking_submitted', 'audio_approved', 'published'].includes(item.audioStatus) || stageReached(item.stage, 'audio_checking')
					if (!hasStarted || !actor?.id) return null
					const isCompleted = ['audio_checking_submitted', 'audio_approved', 'published'].includes(item.audioStatus) || stageReached(item.stage, 'final_verification')
					return { actor, isCompleted }
				}
				case 'final_verification': {
					const actor = item.spocInfo
					const hasStarted = stageReached(item.stage, 'final_verification') || ['audio_approved', 'published'].includes(item.audioStatus)
					if (!hasStarted || !actor?.id) return null
					const isCompleted = item.stage === 'published' || item.audioStatus === 'published'
					return { actor, isCompleted }
				}
				case 'published': {
					const actor = item.spocInfo
					if (item.stage !== 'published' || !actor?.id) return null
					return { actor, isCompleted: true }
				}
				default:
					return null
			}
		}

		const counts = {}
		stageOrder.forEach((stage) => {
			counts[stage] = spocVersions.reduce((sum, item) => {
				const details = getStageProcessDetails(item, stage)
				if (!details?.actor?.id) return sum
				return sum + 1
			}, 0)
		})

		const rows = stageOrder.map((stage) => ({
				stage,
				count: counts[stage] || 0,
				label: spocStageLabels[stage] || stage.replaceAll('_', ' '),
				color: spocStageColors[stage] || 'linear-gradient(180deg, #2d7cff, #14a08f)'
			}))

		const maxCount = Math.max(...rows.map((row) => row.count), 1)
		return rows.map((row) => ({
			...row,
			height: row.count === 0
				? '4%'
				: `${Math.max(16, Math.round((row.count / maxCount) * 100))}%`
		}))
	}, [spocVersions, user?.role])

	const spocDeadlines = useMemo(() => {
		if (user?.role !== 'spoc') return []
		const now = new Date()

		const rows = spocVersions
			.filter((item) => item.feedbackDeadline)
			.map((item) => {
				const due = new Date(item.feedbackDeadline)
				const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
				return {
					title: item.title,
					language: item.language,
					due,
					daysLeft,
					urgency: daysLeft <= 2 ? 'urgent' : daysLeft <= 7 ? 'soon' : 'normal'
				}
			})
			.sort((a, b) => a.due.getTime() - b.due.getTime())

		const filteredRows = urgentOnlyDeadlines
			? rows.filter((item) => item.urgency === 'urgent' || item.urgency === 'soon')
			: rows

		return filteredRows.slice(0, 6)
	}, [spocVersions, user?.role, urgentOnlyDeadlines])

	const spocOpsMetrics = useMemo(() => {
		if (user?.role !== 'spoc') return { overdueItems: 0 }

		const activeRows = spocVersions.filter((item) => item.stage !== 'published')
		const nowMs = Date.now()

		const overdueItems = activeRows.filter((item) => {
			const deadlineKey = stageDeadlineField[item.stage]
			const deadlineValue = deadlineKey ? item[deadlineKey] : null
			return deadlineValue && new Date(deadlineValue).getTime() < nowMs
		}).length

		return { overdueItems }
	}, [spocVersions, user?.role])

	const spocActivity = useMemo(() => {
		const sorted = notifications.slice(0, 20)
		if (!urgentOnlyActivity) return sorted.slice(0, 6)

		return sorted
			.filter((item) => {
				const text = `${item.title || ''} ${item.message || ''}`.toLowerCase()
				return !item.isRead || /(urgent|overdue|blocker|rejected|deadline)/.test(text)
			})
			.slice(0, 6)
	}, [notifications, urgentOnlyActivity])

	const taskCards = useMemo(() => {
		if (!Array.isArray(assigned) || assigned.length === 0) return []

		return assigned.slice(0, 4).map((book) => {
			const version = (book.languageVersions || []).find((v) =>
				[v.assignedTranslator, v.assignedChecker, v.assignedRecorder, v.assignedAudioChecker].some(
					(id) => id === user?.id || id?._id === user?.id
				)
			)

			return {
				id: book._id,
				title: book.title,
				language: version?.language || user?.language || '-',
				stage: version?.currentStage || 'translation',
				deadline:
					version?.translatorDeadline ||
					version?.checkerDeadline ||
					version?.recorderDeadline ||
					version?.audioCheckerDeadline ||
					null
			}
		})
	}, [assigned, user?.id, user?.language])

	const displayNotifications = notifications.slice(0, 5)

	const adminVersions = useMemo(() => {
		if (user?.role !== 'admin') return []
		return sourceBooks.flatMap((book) =>
			(book.languageVersions || []).map((version) => ({
				bookId: book._id,
				versionId: version._id,
				title: book.title,
				language: version.language,
				stage: version.currentStage || 'translation',
				audioStatus: version.audioStatus,
				feedbackDeadline: version.feedbackDeadline,
				updatedAt: version.updatedAt,
				isBlockedBySpoc: Boolean(version.isBlockedBySpoc),
				translatorDeadline: version.translatorDeadline,
				checkerDeadline: version.checkerDeadline,
				recorderDeadline: version.recorderDeadline,
				audioCheckerDeadline: version.audioCheckerDeadline,
				assignedTranslator: version.assignedTranslator?.name || '-',
				assignedChecker: version.assignedChecker?.name || '-',
				assignedRecorder: version.assignedRecorder?.name || '-',
				assignedAudioChecker: version.assignedAudioChecker?.name || '-'
			}))
		)
	}, [sourceBooks, user?.role])

	const adminPipelineCounts = useMemo(() => {
		if (user?.role !== 'admin') return {}
		const counts = Object.fromEntries(pipelineStages.map((stage) => [stage.key, 0]))
		adminVersions.forEach((item) => {
			if (counts[item.stage] !== undefined) counts[item.stage] += 1
		})
		return counts
	}, [adminVersions, user?.role])

	const adminAlerts = useMemo(() => {
		if (user?.role !== 'admin') return []
		const nowMs = Date.now()
		const overdue = adminVersions.filter((item) => {
			const deadlineKey = stageDeadlineField[item.stage]
			const deadlineValue = deadlineKey ? item[deadlineKey] : null
			return Boolean(deadlineValue && new Date(deadlineValue).getTime() < nowMs)
		}).length
		const blocked = adminVersions.filter((item) => item.isBlockedBySpoc).length
		const stale = adminVersions.filter((item) => {
			if (!item.updatedAt || item.stage === 'published') return false
			return nowMs - new Date(item.updatedAt).getTime() > 1000 * 60 * 60 * 24 * 3
		}).length

		return [
			{ tone: 'danger', title: 'Translation/Stage Delays', message: `${overdue} versions are past deadline.` },
			{ tone: 'warning', title: 'Pending Approvals', message: `${adminPipelineCounts.checking || 0} versions waiting for text vetting.` },
			{ tone: blocked > 0 ? 'danger' : 'warning', title: 'Quality/Blocker Issues', message: `${blocked} blocked, ${stale} stale versions need intervention.` }
		]
	}, [adminPipelineCounts.checking, adminVersions, user?.role])

	const adminActivity = useMemo(() => {
		if (user?.role !== 'admin') return []
		return notifications.slice(0, 8).map((item) => ({
			id: item._id,
			title: item.title,
			message: item.message,
			meta: `${item.type || 'system'} • ${formatRelativeTime(item.createdAt)}`
		}))
	}, [notifications, user?.role])

	if (user?.role === 'spoc') {
		return (
			<Navbar notifications={notifications.filter((item) => !item.isRead).length}>
				<section className="dashboard-head">
					<h2>Language SPOC Dashboard</h2>
					<p>Manage and oversee your assigned audiobooks for {user?.language || 'your language'}.</p>
				</section>

				<section className="spoc-overview-grid">
					<article className="spoc-language-card">
						<div className="spoc-card-top">
							<span className="spoc-icon">◎</span>
							<span>{spocSummary?.total || 0} books</span>
						</div>
						<h3>{user?.language || 'Language'}</h3>
						<p>Completion: <strong>{spocSummary?.completion || 0}%</strong></p>
						<p>Published: <strong>{spocSummary?.published || 0}</strong></p>
					</article>

					<article className="stat-card">
						<h3>Text Reviews Pending</h3>
						<strong>{spocSummary?.textReviewPending || 0}</strong>
					</article>
					<article className="stat-card">
						<h3>Audio Final Pending</h3>
						<strong>{spocSummary?.audioFinalPending || 0}</strong>
					</article>
					<article className="stat-card">
						<h3>Active Blockers</h3>
						<strong>{spocSummary?.blocked || 0}</strong>
					</article>
					<article className="stat-card">
						<h3>Overdue Items</h3>
						<strong>{spocOpsMetrics.overdueItems}</strong>
					</article>
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

				<section className="panel">
					<h3>Pipeline Analytics</h3>
					<div className="row-actions">
						<button
							type="button"
							className="mini-btn"
							onClick={() => setSelectedStage('all')}
							disabled={selectedStage === 'all'}
						>
							Show All Stages
						</button>
					</div>
					{spocStageBreakdown.length > 0 ? (
						<div className="pipeline-vertical-wrap">
							<div className="pipeline-vertical-bars">
							{spocStageBreakdown.map((row) => (
									<div className="pipeline-vertical-col" key={row.stage}>
										<button
											type="button"
											className={`pipeline-stage-btn ${selectedStage === row.stage ? 'active' : ''}`}
											onClick={() => setSelectedStage((prev) => (prev === row.stage ? 'all' : row.stage))}
										>
											<div className="pipeline-vertical-track">
												<div className="pipeline-vertical-fill" style={{ height: row.height, background: row.color }} />
											</div>
											<p>{row.label}</p>
											<strong>{row.count}</strong>
										</button>
									</div>
							))}
							</div>
						</div>
					) : (
						<p>No stage data available yet for your language.</p>
					)}
				</section>

				<section className="panel">
					<h3>Assigned Audiobooks</h3>
					<p className="pipeline-filter-pill">
						{selectedStage === 'all'
							? 'Showing only checker-approved books sent to SPOC review.'
							: `Filtered by ${spocStageLabels[selectedStage] || selectedStage}: showing completed/in-progress books for this stage.`}
					</p>
					{loading ? (
						<p>Loading...</p>
					) : spocAssignedBooks.length > 0 ? (
						<div className="spoc-task-list">
							{spocAssignedBooks.map((item) => (
								<article className="spoc-task-row" key={`${item.bookId}-${item.versionId}`}>
									<div className="spoc-task-head">
										<h4>{item.title}</h4>
										<span className={`spoc-chip ${item.processState === 'completed' ? 'ok' : 'warn'}`}>
											{item.processState === 'completed'
												? 'Completed'
												: item.processState === 'pending'
													? 'Unassigned'
													: 'In Progress'}
										</span>
									</div>
									<div className="spoc-task-meta">
										<p><strong>Stage:</strong> {item.stageLabel}</p>
										<p className="spoc-owner-line"><strong>Acquired By:</strong> {item.currentOwnerName}</p>
										<p><strong>Email:</strong> {item.currentOwnerEmail || '-'}</p>
									</div>
								</article>
							))}
						</div>
					) : (
						<p>No audiobooks found for this filter yet.</p>
					)}
				</section>

				<section className="panel">
					<h3>Upcoming Feedback Deadlines</h3>
					<div className="row-actions">
						<button
							type="button"
							className="mini-btn"
							onClick={() => setUrgentOnlyDeadlines((prev) => !prev)}
						>
							{urgentOnlyDeadlines ? 'Show All Deadlines' : 'Urgent Only'}
						</button>
					</div>
					{spocDeadlines.length > 0 ? (
						<ul className="deadline-list">
							{spocDeadlines.map((item) => (
								<li key={`${item.title}-${item.due.toISOString()}`}>
									<div>
										<strong>{item.title} - {item.language}</strong>
										<p>Due {item.due.toLocaleDateString()} ({item.daysLeft} days)</p>
									</div>
									<span className={`deadline-pill ${item.urgency}`}>{item.urgency}</span>
								</li>
							))}
						</ul>
					) : (
						<p>{urgentOnlyDeadlines ? 'No urgent deadlines right now.' : 'No active feedback deadlines right now.'}</p>
					)}
				</section>

				<section className="panel">
					<h3>Real-time Activity</h3>
					<div className="row-actions">
						<button
							type="button"
							className="mini-btn"
							onClick={() => setUrgentOnlyActivity((prev) => !prev)}
						>
							{urgentOnlyActivity ? 'Show All Activity' : 'Urgent Activity'}
						</button>
					</div>
					{spocActivity.length > 0 ? (
						<ul className="activity-list">
							{spocActivity.map((item) => (
								<li key={item._id}>
									<strong>{item.title}</strong>
									<p>{item.message}</p>
								</li>
							))}
						</ul>
					) : (
						<p>{urgentOnlyActivity ? 'No urgent activity right now.' : 'No recent activity.'}</p>
					)}
				</section>
			</Navbar>
		)
	}

	if (user?.role === 'admin') {
		return (
			<Navbar notifications={notifications.filter((item) => !item.isRead).length}>
				<section className="dashboard-head admin-head">
					<div>
						<h2>Super Admin Dashboard</h2>
						<p>Full system control and analytics.</p>
					</div>
				</section>

				<section className="stat-grid">
					<article className="stat-card">
						<h3>Total Books in System</h3>
						<strong>{stats.totalBooks}</strong>
					</article>
				</section>

				<section className="panel admin-language-report-panel">
					<div className="admin-language-filter-row">
						<div>
							<h3>Language-wise Progress Report</h3>
							<p>Select a language to view workflow stage counts.</p>
						</div>
						<label className="admin-language-filter" htmlFor="admin-language-filter">
							<span>Language</span>
							<select
								id="admin-language-filter"
								value={selectedAdminLanguage}
								onChange={(event) => setSelectedAdminLanguage(event.target.value)}
							>
								{adminLanguageOptions.map((language) => (
									<option key={language} value={language}>{language}</option>
								))}
							</select>
						</label>
					</div>

					{adminLanguageOptions.length > 0 && adminLanguageReport ? (
						<>
							<p className="admin-language-spoc"><strong>SPOC:</strong> {adminLanguageReport.spocLabel}</p>
							<div className="admin-language-stage-grid">
								{adminLanguageReport.stages.map((stage) => (
									<article className="admin-language-stage-card" key={stage.key}>
										<p>{stage.label}</p>
										<strong>{stage.count}</strong>
									</article>
								))}
							</div>
						</>
					) : (
						<p>No language report data available yet.</p>
					)}
				</section>

				<section className="admin-split-grid">
					<section className="panel">
						<div className="admin-section-head">

							<h3>Alerts & Issues</h3>
							<span>{adminAlerts.length} Active</span>
						</div>
						<div className="admin-alert-list">
							{adminAlerts.map((alert) => (
								<article className={`admin-alert-card ${alert.tone}`} key={alert.title}>
									<h4>{alert.title}</h4>
									<p>{alert.message}</p>
								</article>
							))}
						</div>
					</section>

					<section className="panel">
						<h3>Real-time Activity</h3>
						{adminActivity.length > 0 ? (
							<ul className="admin-activity-list">
								{adminActivity.map((item) => (
									<li key={item.id}>
										<strong>{item.title}</strong>
										<p>{item.message}</p>
										<span>{item.meta}</span>
									</li>
								))}
							</ul>
						) : (
							<p>No recent activity.</p>
						)}
					</section>
				</section>

			</Navbar>
		)
	}

	return (
		<Navbar notifications={notifications.filter((item) => !item.isRead).length}>
			<section className="dashboard-head">
				<h2>Global Dashboard</h2>
				<p>Monitor your audiobook production pipeline.</p>
			</section>

			<section className="stat-grid">
				<article className="stat-card">
					<h3>Total Books</h3>
					<strong>{stats.totalBooks}</strong>
				</article>
				<article className="stat-card">
					<h3>{user?.role === 'admin' ? 'Active Users' : 'My Assignments'}</h3>
					<strong>{stats.users}</strong>
				</article>
				<article className="stat-card">
					<h3>Published</h3>
					<strong>{stats.completion}%</strong>
				</article>
			</section>

			<section className="panel">
				<h3>Production Pipeline</h3>
				<div className="pipeline-row">
					{pipelineStages.map((stage) => (
						<div className="pipe-step" key={stage.key}>
							<span>{stage.label}</span>
							<strong>{stageCounts[stage.key]}</strong>
						</div>
					))}
				</div>
			</section>

			{user?.role !== 'checker' && (
				<section className="panel">
					<h3>{user?.role === 'admin' ? 'Active Books' : 'Your Assigned Tasks'}</h3>
					{loading ? (
						<p>Loading...</p>
					) : taskCards.length > 0 ? (
						<div className="task-grid">
							{taskCards.map((item) => (
								<article className="task-card" key={item.id}>
									<h4>{item.title}</h4>
									<p>Language: {item.language}</p>
									<p>Stage: {item.stage.replace('_', ' ')}</p>
									<p>Deadline: {item.deadline ? new Date(item.deadline).toLocaleDateString() : 'Not set'}</p>
								</article>
							))}
						</div>
					) : (
						<p>No assigned tasks yet.</p>
					)}
				</section>
			)}

			<section className="panel">
				<div>
					<h3>Real-time Activity</h3>
					{displayNotifications.length > 0 ? (
						<ul className="activity-list">
							{displayNotifications.map((item) => (
								<li key={item._id}>
									<strong>{item.title}</strong>
									<p>{item.message}</p>
								</li>
							))}
						</ul>
					) : (
						<p>No recent activity.</p>
					)}
				</div>
			</section>
		</Navbar>
	)
}

export default AdminDashboard
