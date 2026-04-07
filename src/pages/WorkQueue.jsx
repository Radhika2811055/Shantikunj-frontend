import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { claimsService } from '../api/services'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/workqueue/StatusBadge'
import ToastStack from '../components/workqueue/ToastStack'

const roleClaimTypes = {
  translator: 'translation',
  checker: 'checking',
  recorder: 'audio',
  audio_checker: 'audio_check'
}

const toValidDate = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const WorkQueue = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const currentUserId = user?.id || user?._id || ''
  const [available, setAvailable] = useState([])
  const [myClaim, setMyClaim] = useState(null)
  const [assigned, setAssigned] = useState([])
  const [claimHistory, setClaimHistory] = useState([])
  const [roleBooks, setRoleBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [formByKey, setFormByKey] = useState({})
  const [claimDaysByBook, setClaimDaysByBook] = useState({})
  const [selectedBlockerTaskKey, setSelectedBlockerTaskKey] = useState('')
  const [blockerReason, setBlockerReason] = useState('')
  const [spocTextQuery, setSpocTextQuery] = useState('')
  const [spocTextFilter, setSpocTextFilter] = useState('all')
  const [expandedSpocTextTaskKey, setExpandedSpocTextTaskKey] = useState('')
  const [expandedSpocAudioTaskKey, setExpandedSpocAudioTaskKey] = useState('')
  const [toasts, setToasts] = useState([])

  const canClaim = ['translator', 'checker', 'recorder', 'audio_checker'].includes(user?.role)
  const isSpoc = user?.role === 'spoc'
  const isRegional = user?.role === 'regional_team'
  const isRecorder = user?.role === 'recorder'

  const taskKey = (bookId, versionId) => `${bookId}:${versionId}`

  const isCurrentUser = useCallback((value) => {
    if (!value || !currentUserId) return false

    const normalized = value?._id || value
    return normalized?.toString() === currentUserId.toString()
  }, [currentUserId])

  const getClaimDays = (bookId) => {
    const raw = claimDaysByBook[bookId]
    const parsed = Number(raw)
    if (!Number.isInteger(parsed)) return 2
    return Math.min(30, Math.max(1, parsed))
  }

  const updateClaimDays = (bookId, value) => {
    const parsed = Number(value)
    const bounded = Number.isInteger(parsed) ? Math.min(30, Math.max(1, parsed)) : 2
    setClaimDaysByBook((prev) => ({
      ...prev,
      [bookId]: bounded
    }))
  }

  const updateFormField = (bookId, versionId, field, value) => {
    const key = taskKey(bookId, versionId)
    setFormByKey((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value
      }
    }))
  }

  const pushToast = (text, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setToasts((prev) => [...prev, { id, text, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 3200)
  }

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [availableRes, myClaimRes, assignedRes, historyRes, booksRes] = await Promise.all([
        canClaim ? api.get('/claims/available') : Promise.resolve({ data: [] }),
        canClaim ? api.get('/claims/my-claim') : Promise.resolve({ data: { claim: null } }),
        canClaim ? api.get('/books/my-assignments') : Promise.resolve({ data: [] }),
        canClaim ? api.get('/claims/my-history').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        (isSpoc || isRegional) ? api.get('/books') : Promise.resolve({ data: [] })
      ])

      setAvailable(availableRes.data || [])
      setMyClaim(myClaimRes.data?.claim || null)
      setAssigned(Array.isArray(assignedRes.data) ? assignedRes.data : [])
      setClaimHistory(Array.isArray(historyRes.data) ? historyRes.data : [])

      if (isSpoc || isRegional) {
        const roleBookIds = Array.isArray(booksRes.data) ? booksRes.data.map((book) => book._id) : []
        const detailResponses = await Promise.all(
          roleBookIds.map((id) => api.get(`/books/${id}`).catch(() => null))
        )
        setRoleBooks(
          detailResponses
            .map((resp) => resp?.data)
            .filter(Boolean)
        )
      } else {
        setRoleBooks([])
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to load work queue'
      pushToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [canClaim, isRegional, isSpoc])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onClaim = async (bookId, language, daysCommitted) => {
    if (!canClaim) return
    const claimType = roleClaimTypes[user.role]
    if (!claimType) return

    const committedDays = Math.min(30, Math.max(1, Number(daysCommitted) || 2))

    setBusyId(`claim:${bookId}`)
    try {
      await api.post(`/claims/books/${bookId}/claim`, {
        language,
        claimType,
        daysCommitted: committedDays
      })
      await loadData()
      pushToast('Task claimed successfully.', 'success')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to claim task'
      pushToast(msg, 'error')
    } finally {
      setBusyId('')
    }
  }

  const onSendInterest = async (bookId, language) => {
    if (!canClaim) return

    setBusyId(`interest:${bookId}`)
    try {
      await claimsService.sendInterest(bookId, { language, claimType: roleClaimTypes[user.role] })
      pushToast('Interest sent successfully.', 'success')
    } catch (err) {
      const msg = err?.userMessage || err?.response?.data?.message || 'Failed to send interest'
      pushToast(msg, 'error')
    } finally {
      setBusyId('')
    }
  }

  const submitTask = async ({ bookId, versionId, endpoint, payload, successMessage, method = 'post' }) => {
    const key = taskKey(bookId, versionId)
    setBusyId(key)
    try {
      await api({
        method,
        url: endpoint,
        data: payload
      })
      await loadData()
      pushToast(successMessage, 'success')
      return true
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to submit task'
      pushToast(msg, 'error')
      return false
    } finally {
      setBusyId('')
    }
  }

  const taskCards = useMemo(() => {
    if (!Array.isArray(assigned) || !user?.role) return []

    const cards = []

    assigned.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        const isTranslatorTask = user.role === 'translator' && isCurrentUser(version.assignedTranslator)
        const isCheckerTask = user.role === 'checker' && isCurrentUser(version.assignedChecker)
        const isAudioCheckerTask = user.role === 'audio_checker' && isCurrentUser(version.assignedAudioChecker)
        const isRecorderTask = user.role === 'recorder' && isCurrentUser(version.assignedRecorder)

        if (!isTranslatorTask && !isCheckerTask && !isAudioCheckerTask && !isRecorderTask) return

        let taskType = 'translation'
        let actionLabel = 'No action'
        let canSubmit = false
        let deadline = null

        if (isTranslatorTask) {
          taskType = 'translation'

          // Translator queue should only show versions currently in translation stage.
          if (version.currentStage !== 'translation') return

          canSubmit = version.currentStage === 'translation' && version.textStatus === 'translation_in_progress'
          actionLabel = canSubmit ? 'Submit Translation PDF' : 'Waiting for translation readiness'
          deadline = version.translatorDeadline || null
        } else if (isCheckerTask && version.currentStage === 'checking') {
          taskType = 'checking'
          canSubmit = version.textStatus === 'checking_in_progress'
          actionLabel = canSubmit ? 'Review translated text and submit decision' : 'Waiting for checking stage'
          deadline = version.checkerDeadline || null
        } else if (isAudioCheckerTask && version.currentStage === 'audio_checking') {
          taskType = 'audio_check'
          canSubmit = version.audioStatus === 'audio_checking_in_progress'
          actionLabel = canSubmit ? 'Submit Audio Review' : 'Waiting for audio checking stage'
          deadline = version.audioCheckerDeadline || null
        } else if (isRecorderTask) {
          taskType = 'audio'
          canSubmit = version.currentStage === 'audio_generation' && version.audioStatus === 'audio_generated'
          actionLabel = canSubmit ? 'Submit Audio MP3' : 'Waiting for audio generation stage'
          deadline = version.recorderDeadline || null
        }

        cards.push({
          bookId: book._id,
          versionId: version._id,
          title: book.title,
          bookNumber: book.bookNumber,
          language: version.language,
          stage: version.currentStage,
          textStatus: version.textStatus,
          audioStatus: version.audioStatus,
          sourcePdfUrl: book.originalPdfUrl || '',
          translatedTextUrl: version.textFileUrl || '',
          audioUrl: version.audioUrl || '',
          audioFiles: Array.isArray(version.audioFiles) && version.audioFiles.length > 0
            ? version.audioFiles.filter(Boolean)
            : (version.audioUrl ? [version.audioUrl] : []),
          checkerFeedback: version.feedback || '',
          taskType,
          canSubmit,
          actionLabel,
          deadline
        })
      })
    })

    return cards
  }, [assigned, isCurrentUser, user?.role])

  const checkerAudioTasks = useMemo(() => {
    if (user?.role !== 'audio_checker') return []
    return taskCards.filter((task) => task.taskType === 'audio_check')
  }, [taskCards, user?.role])

  const recorderStats = useMemo(() => {
    if (!isRecorder) {
      return {
        assignedToMe: 0,
        completedThisMonth: 0,
        deadlineSoon: 0,
        availableToClaim: 0
      }
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const recorderTasks = taskCards.filter((task) => task.taskType === 'audio')
    const reopenedTaskKeys = new Set(
      recorderTasks
        .filter((task) => task.canSubmit)
        .map((task) => `${task.bookId}:${(task.language || '').toLowerCase()}`)
    )

    const completedThisMonth = claimHistory.filter((claim) => {
      if (claim?.claimType !== 'audio' || claim?.status !== 'submitted') return false
      if (new Date(claim.updatedAt || 0) < monthStart) return false

      const claimBookId = claim?.book?._id || claim?.book
      const claimKey = `${claimBookId || ''}:${(claim?.language || '').toLowerCase()}`

      // If the same task is back in recorder's actionable queue, it should not count as completed.
      return !reopenedTaskKeys.has(claimKey)
    }).length

    const deadlineSoon = recorderTasks.filter((task) => {
      if (!task.deadline) return false
      const diffMs = new Date(task.deadline).getTime() - now.getTime()
      return diffMs >= 0 && diffMs <= 3 * 24 * 60 * 60 * 1000
    }).length

    const availableToClaim = (Array.isArray(available) ? available : []).filter((item) => {
      if (item?.claimType !== 'audio') return false
      if (!user?.language) return true
      return item?.version?.language === user.language
    }).length

    return {
      assignedToMe: recorderTasks.length,
      completedThisMonth,
      deadlineSoon,
      availableToClaim
    }
  }, [available, claimHistory, isRecorder, taskCards, user?.language])

  const onSubmitAudioReview = async (task, decision = 'approved') => {
    const key = taskKey(task.bookId, task.versionId)
    const form = formByKey[key] || {}
    const normalizedDecision = decision === 'rejected' ? 'rejected' : 'approved'
    const feedback = (form.feedback || '').trim()
    const predefinedDeadline = toValidDate(task.deadline)

    if (normalizedDecision === 'rejected' && !feedback) {
      pushToast('Please add feedback before submitting a rejected audio review.', 'error')
      return
    }

    if (normalizedDecision === 'approved') {
      if (!predefinedDeadline) {
        pushToast('No predefined deadline is available for this task. Please contact SPOC/admin.', 'error')
        return
      }

      if (predefinedDeadline.getTime() <= Date.now()) {
        pushToast('The predefined task deadline has passed. Please contact SPOC/admin.', 'error')
        return
      }
    }

    const payload = {
      decision: normalizedDecision,
      feedback: feedback || null
    }

    if (normalizedDecision === 'approved') {
      payload.feedbackDeadline = predefinedDeadline.toISOString()
    }

    await submitTask({
      bookId: task.bookId,
      versionId: task.versionId,
      endpoint: `/books/${task.bookId}/versions/${task.versionId}/submit-audio-review`,
      payload,
      successMessage: normalizedDecision === 'approved'
        ? 'Audio review approved and sent for final verification.'
        : 'Audio rejected and sent back to recorder for revision.'
    })
  }

  const subtitle = useMemo(() => {
    if (user?.role === 'regional_team') return 'Submit language feedback within the review window.'
    if (user?.role === 'spoc') return 'Review text/audio submissions and manage blockers.'
    if (user?.role === 'checker') return 'Claim text-vetting tasks, compare against Hindi source, and send approve or revision feedback.'
    if (user?.role === 'audio_checker') return 'Claim and verify submitted audiobook files.'
    if (user?.role === 'recorder') return 'Upload MP3 audio, track progress, and complete assigned audiobook production tasks.'
    return 'Claim and complete your role-based tasks.'
  }, [user?.role])

  const spocTextTasks = useMemo(() => {
    if (!isSpoc || !Array.isArray(roleBooks)) return []

    const hasTextForReview = (version) => {
      const primary = Boolean(String(version?.textFileUrl || '').trim())
      const multi = Array.isArray(version?.textFileUrls)
        && version.textFileUrls.some((item) => Boolean(String(item || '').trim()))
      return primary || multi
    }

    const isSpocTextReady = (version) => {
      if (!version || version.currentStage !== 'spoc_review') return false
      if (version.textStatus === 'checking_submitted') return true
      // Backward-compat for legacy records already moved to SPOC stage.
      return version.textStatus === 'checking_in_progress' && hasTextForReview(version)
    }

    const tasks = []
    roleBooks.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        if (version.language !== user?.language) return
        if (isSpocTextReady(version)) {
          tasks.push({
            bookId: book._id,
            versionId: version._id,
            title: book.title,
            bookNumber: book.bookNumber,
            language: version.language,
            stage: version.currentStage,
            textStatus: version.textStatus,
            checkerFeedback: version.feedback || '',
            translatedTextUrl: version.textFileUrl || '',
            sourcePdfUrl: book.originalPdfUrl || '',
            updatedAt: version.updatedAt || book.updatedAt
          })
        }
      })
    })

    return tasks.sort((a, b) => {
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    })
  }, [isSpoc, roleBooks, user?.language])

  const spocVisibleTextTasks = useMemo(() => {
    if (!isSpoc) return []

    const query = spocTextQuery.trim().toLowerCase()

    return spocTextTasks.filter((task) => {
      if (spocTextFilter === 'with_feedback' && !task.checkerFeedback) return false
      if (spocTextFilter === 'without_feedback' && task.checkerFeedback) return false

      if (!query) return true

      const haystack = `${task.title || ''} ${task.bookNumber || ''} ${task.language || ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [isSpoc, spocTextFilter, spocTextQuery, spocTextTasks])

  useEffect(() => {
    if (!expandedSpocTextTaskKey) return

    const stillVisible = spocVisibleTextTasks.some((task) => {
      return taskKey(task.bookId, task.versionId) === expandedSpocTextTaskKey
    })

    if (!stillVisible) {
      setExpandedSpocTextTaskKey('')
    }
  }, [expandedSpocTextTaskKey, spocVisibleTextTasks])

  const onSubmitSpocTextReview = async (task) => {
    const key = taskKey(task.bookId, task.versionId)
    const form = formByKey[key] || {}
    const decision = form.decision || 'approved'
    const feedback = (form.feedback || '').trim()

    if (decision === 'rejected' && !feedback) {
      pushToast('Please add feedback before rejecting and sending back.', 'error')
      return
    }

    await submitTask({
      bookId: task.bookId,
      versionId: task.versionId,
      endpoint: `/books/${task.bookId}/versions/${task.versionId}/spoc-review`,
      method: 'put',
      payload: {
        decision,
        feedback: feedback || null
      },
      successMessage: decision === 'approved'
        ? 'SPOC review approved and sent to audio recorder.'
        : 'SPOC rejected with feedback and sent back to translator.'
    })
  }

  const spocAudioTasks = useMemo(() => {
    if (!isSpoc || !Array.isArray(roleBooks)) return []

    const tasks = []
    roleBooks.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        if (version.language !== user?.language) return
        if (version.currentStage === 'final_verification' && version.audioStatus === 'audio_checking_submitted') {
          tasks.push({
            bookId: book._id,
            versionId: version._id,
            title: book.title,
            bookNumber: book.bookNumber,
            language: version.language,
            stage: version.currentStage,
            audioStatus: version.audioStatus,
            feedbackDeadline: version.feedbackDeadline,
            checkerFeedback: version.feedback || '',
            audioUrl: version.audioUrl || '',
            audioFiles: Array.isArray(version.audioFiles) && version.audioFiles.length > 0
              ? version.audioFiles.filter(Boolean)
              : (version.audioUrl ? [version.audioUrl] : []),
            updatedAt: version.updatedAt || book.updatedAt
          })
        }
      })
    })

    return tasks.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
  }, [isSpoc, roleBooks, user?.language])

  useEffect(() => {
    if (!expandedSpocAudioTaskKey) return

    const stillVisible = spocAudioTasks.some((task) => {
      return taskKey(task.bookId, task.versionId) === expandedSpocAudioTaskKey
    })

    if (!stillVisible) {
      setExpandedSpocAudioTaskKey('')
    }
  }, [expandedSpocAudioTaskKey, spocAudioTasks])

  const onSubmitSpocAudioReview = async (task) => {
    const key = taskKey(task.bookId, task.versionId)
    const form = formByKey[key] || {}
    const decision = form.decision || 'approved'
    const feedback = (form.feedback || '').trim()

    if (decision === 'rejected' && !feedback) {
      pushToast('Please add feedback before rejecting and sending back to recorder.', 'error')
      return
    }

    await submitTask({
      bookId: task.bookId,
      versionId: task.versionId,
      endpoint: `/books/${task.bookId}/versions/${task.versionId}/spoc-audio-approval`,
      method: 'put',
      payload: {
        decision,
        feedback: feedback || null
      },
      successMessage: decision === 'approved'
        ? 'SPOC audio approved and sent to admin for publish.'
        : 'SPOC audio rejected with feedback and sent back to recorder.'
    })
  }

  const spocBlockerCandidates = useMemo(() => {
    if (!isSpoc || !Array.isArray(roleBooks)) return []

    const tasks = []
    roleBooks.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        if (version.language !== user?.language) return
        if (version.currentStage === 'published' || version.audioStatus === 'published') return

        tasks.push({
          key: taskKey(book._id, version._id),
          bookId: book._id,
          versionId: version._id,
          title: book.title,
          language: version.language,
          stage: version.currentStage,
          isBlockedBySpoc: Boolean(version.isBlockedBySpoc),
          blockerNote: version.blockerNote || '',
          updatedAt: version.updatedAt
        })
      })
    })
    return tasks
  }, [isSpoc, roleBooks, user?.language])

  const spocBlockedTasks = useMemo(() => {
    if (!isSpoc) return []

    return spocBlockerCandidates
      .filter((item) => item.isBlockedBySpoc)
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
  }, [isSpoc, spocBlockerCandidates])

  const blockerSelectionOptions = useMemo(() => {
    if (!isSpoc) return []

    return spocBlockerCandidates
      .filter((item) => !item.isBlockedBySpoc)
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [isSpoc, spocBlockerCandidates])

  const selectedBlockerTask = useMemo(() => {
    if (!selectedBlockerTaskKey) return null
    return spocBlockerCandidates.find((item) => item.key === selectedBlockerTaskKey) || null
  }, [spocBlockerCandidates, selectedBlockerTaskKey])

  useEffect(() => {
    if (!selectedBlockerTaskKey) return

    const stillAvailable = spocBlockerCandidates.some((item) => item.key === selectedBlockerTaskKey)
    if (!stillAvailable) {
      setSelectedBlockerTaskKey('')
    }
  }, [selectedBlockerTaskKey, spocBlockerCandidates])

  const onEnableSpocBlocker = async () => {
    if (!selectedBlockerTask) {
      pushToast('Please select a book from the blocker dropdown.', 'error')
      return
    }

    const reason = blockerReason.trim()
    if (!reason) {
      pushToast('Please provide a blocker reason.', 'error')
      return
    }

    const success = await submitTask({
      bookId: selectedBlockerTask.bookId,
      versionId: selectedBlockerTask.versionId,
      endpoint: `/books/${selectedBlockerTask.bookId}/versions/${selectedBlockerTask.versionId}/blocker`,
      method: 'put',
      payload: {
        isBlocked: true,
        blockerNote: reason
      },
      successMessage: 'Book moved to blocker list.'
    })

    if (success) {
      setSelectedBlockerTaskKey('')
      setBlockerReason('')
    }
  }

  const regionalFeedbackTasks = useMemo(() => {
    if (!isRegional || !Array.isArray(roleBooks)) return []

    const now = new Date()
    const tasks = []
    roleBooks.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        if (version.language !== user?.language) return
        if (version.audioStatus !== 'audio_approved') return
        if (!version.feedbackDeadline) return
        const deadline = new Date(version.feedbackDeadline)
        if (Number.isNaN(deadline.getTime()) || deadline <= now) return

        tasks.push({
          bookId: book._id,
          versionId: version._id,
          title: book.title,
          language: version.language,
          feedbackDeadline: version.feedbackDeadline,
          audioUrl: version.audioUrl || ''
        })
      })
    })
    return tasks
  }, [isRegional, roleBooks, user?.language])

  const renderAssignedTaskCard = (task) => {
    const key = taskKey(task.bookId, task.versionId)
    const form = formByKey[key] || {}
    const audioFeedback = (form.feedback || '').trim()
    const audioFiles = Array.isArray(task.audioFiles) ? task.audioFiles.filter(Boolean) : []
    const isTranslationTask = task.taskType === 'translation'
    const cardClassName = [
      'task-card',
      isTranslationTask ? 'translator-task-card' : '',
      task.taskType === 'audio_check' ? 'audio-review-card' : ''
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <article className={cardClassName} key={key}>
        <h4>{task.title}</h4>
        <p className={isTranslationTask ? 'translator-task-language' : ''}>Language: {task.language}</p>
        <div className={task.taskType === 'audio_check' ? 'audio-review-status-row' : (isTranslationTask ? 'translator-task-status-row' : '')}>
          <StatusBadge label="Stage" value={task.stage} />
          <StatusBadge label="Text" value={task.textStatus} />
          <StatusBadge label="Audio" value={task.audioStatus} />
        </div>
        <p className={isTranslationTask ? 'translator-task-deadline' : ''}>Deadline: {task.deadline ? new Date(task.deadline).toLocaleString() : 'Not set'}</p>

        {task.taskType === 'translation' && task.canSubmit && (
          <>
            <div className="row-actions">
              {task.sourcePdfUrl ? (
                <a
                  className="mini-btn checker-action-link"
                  href={task.sourcePdfUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Hindi PDF
                </a>
              ) : (
                <span className="mini-btn checker-action-link" aria-disabled="true">Hindi PDF unavailable</span>
              )}
            </div>
            <button
              className="mini-btn translator-task-submit-btn"
              type="button"
              onClick={() => navigate(`/translator-upload?versionId=${task.versionId}`)}
            >
              Upload and Submit Translation
            </button>
          </>
        )}

        {task.taskType === 'checking' && task.canSubmit && (
          <>
            <div className="form-row">
              <label>Vetted Text URL (optional)</label>
              <input
                value={form.textFileUrl || ''}
                onChange={(event) => updateFormField(task.bookId, task.versionId, 'textFileUrl', event.target.value)}
                placeholder="https://drive.google.com/..."
              />
            </div>
            <button
              className="mini-btn"
              type="button"
              disabled={busyId === key}
              onClick={() => submitTask({
                bookId: task.bookId,
                versionId: task.versionId,
                endpoint: `/books/${task.bookId}/versions/${task.versionId}/submit-vetted-text`,
                payload: { textFileUrl: (form.textFileUrl || '').trim() || null },
                successMessage: 'Vetted text submitted successfully.'
              })}
            >
              {busyId === key ? 'Submitting...' : 'Submit Vetted Text'}
            </button>
          </>
        )}

        {task.taskType === 'audio' && task.canSubmit && (
          <button
            className="mini-btn"
            type="button"
            onClick={() => navigate(`/audio-upload?versionId=${task.versionId}`)}
          >
            Submit Audio
          </button>
        )}

        {task.taskType === 'audio_check' && task.canSubmit && (
          <>
            {audioFiles.length > 0 ? (
              <div className="audio-review-files-list">
                {audioFiles.map((url, index) => (
                  <div className="audio-review-player-wrap" key={`${url}-${index}`}>
                    <audio controls preload="none" src={url} />
                    <div className="audio-review-link-row">
                      <a href={url} target="_blank" rel="noreferrer">Open audio {index + 1} in new tab</a>
                      <span>{audioFiles.length === 1 ? 'Review full track before deciding' : `Track ${index + 1} of ${audioFiles.length}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : task.audioUrl ? (
              <div className="audio-review-player-wrap">
                <audio controls preload="none" src={task.audioUrl} />
                <div className="audio-review-link-row">
                  <a href={task.audioUrl} target="_blank" rel="noreferrer">Open audio in new tab</a>
                  <span>Review full track before deciding</span>
                </div>
              </div>
            ) : (
              <p className="audio-review-note">Audio file link is unavailable for this task.</p>
            )}

            <div className="row-actions audio-review-links">
              {task.translatedTextUrl ? (
                <a
                  className="mini-btn checker-action-link"
                  href={task.translatedTextUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Translated Text
                </a>
              ) : (
                <button className="mini-btn" type="button" disabled>
                  Translated Text Unavailable
                </button>
              )}
            </div>

            <div className="form-row">
              <label>Feedback (required if sending back to audio recorder)</label>
              <textarea
                rows={3}
                value={form.feedback || ''}
                onChange={(event) => updateFormField(task.bookId, task.versionId, 'feedback', event.target.value)}
                placeholder="Reviewer notes"
              />
            </div>

            <div className="row-actions checker-review-actions audio-review-actions">
              <button
                className="mini-btn audio-review-submit"
                type="button"
                disabled={busyId === key || !task.deadline}
                onClick={() => onSubmitAudioReview(task, 'approved')}
              >
                {busyId === key ? 'Submitting...' : 'Send to SPOC'}
              </button>

              <button
                className="mini-btn danger audio-review-submit"
                type="button"
                disabled={busyId === key || !audioFeedback}
                onClick={() => onSubmitAudioReview(task, 'rejected')}
              >
                {busyId === key ? 'Submitting...' : 'Send to Recorder'}
              </button>
            </div>
          </>
        )}

        {!task.canSubmit && (
          <p>{task.actionLabel}</p>
        )}
      </article>
    )
  }

  return (
    <Navbar>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <section className="dashboard-head">
        <h2>Work Queue</h2>
        <p>{subtitle}</p>
      </section>

      {isRecorder && (
        <section className="panel">
          <h3>Progress Report</h3>
          {loading ? (
            <p>Loading progress report...</p>
          ) : (
            <div className="stat-grid">
              <article className="stat-card">
                <h3>Assigned Tasks</h3>
                <strong>{recorderStats.assignedToMe}</strong>
              </article>
              <article className="stat-card">
                <h3>Deadlines in 3 Days</h3>
                <strong>{recorderStats.deadlineSoon}</strong>
              </article>
              <article className="stat-card">
                <h3>Available To Claim</h3>
                <strong>{recorderStats.availableToClaim}</strong>
              </article>
            </div>
          )}
        </section>
      )}

      {user?.role === 'checker' ? null : user?.role === 'audio_checker' ? (
        <section className="panel">
          <h3>Audio Checking</h3>
          {!canClaim ? (
            <p>This role currently has view-only queue access in this prototype.</p>
          ) : loading ? (
            <p>Loading...</p>
          ) : checkerAudioTasks.length === 0 ? (
            <p>No audio checking tasks right now.</p>
          ) : (
            <div className="task-grid two-col-grid">
              {checkerAudioTasks.map(renderAssignedTaskCard)}
            </div>
          )}
        </section>
      ) : canClaim ? (
        <section className="panel">
          <h3>My Assigned Tasks</h3>
          {loading ? (
            <p>Loading...</p>
          ) : taskCards.length === 0 ? (
            <p>No assigned tasks right now.</p>
          ) : (
            <div className="task-grid two-col-grid">
              {taskCards.map(renderAssignedTaskCard)}
            </div>
          )}
        </section>
      ) : null}

      {canClaim && user?.role !== 'checker' && (
        <>
          <section className="panel">
            <h3>Available Tasks</h3>
            {loading ? (
              <p>Loading...</p>
            ) : available.length === 0 ? (
              <p>No tasks available right now.</p>
            ) : (
              <div className="task-grid">
                {available.map((item) => {
                  const days = getClaimDays(item._id)
                  const projectedDeadline = new Date()
                  projectedDeadline.setDate(projectedDeadline.getDate() + days)

                  return (
                    <article className="task-card" key={item._id}>
                    <h4>{item.title}</h4>
                    <p>Language: {item.version?.language || '-'}</p>
                    <StatusBadge label="Stage" value={item.version?.currentStage || '-'} />
                    <div className="form-row">
                      <label>Days You Commit</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={days}
                        onChange={(event) => updateClaimDays(item._id, event.target.value)}
                      />
                    </div>
                    <p>Auto Deadline: {projectedDeadline.toLocaleString()}</p>
                    {canClaim && (
                      <div className="row-actions">
                        <button
                          className="mini-btn"
                          type="button"
                          onClick={() => onClaim(item._id, item.version?.language, days)}
                          disabled={busyId === `claim:${item._id}` || Boolean(myClaim)}
                        >
                          {busyId === `claim:${item._id}` ? 'Claiming...' : 'Claim'}
                        </button>
                        <button
                          className="mini-btn"
                          type="button"
                          onClick={() => onSendInterest(item._id, item.version?.language)}
                          disabled={busyId === `interest:${item._id}`}
                        >
                          {busyId === `interest:${item._id}` ? 'Sending...' : 'Send Interest'}
                        </button>
                      </div>
                    )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}

      {isSpoc && (
        <>
          <section className="panel spoc-review-panel">
            <div className="checker-section-head">
              <h3>SPOC Text Review Tasks</h3>
              <span>{spocVisibleTextTasks.length} shown</span>
              <div className="checker-task-filters spoc-review-filters">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'with_feedback', label: 'With Checker Notes' },
                  { key: 'without_feedback', label: 'No Checker Notes' }
                ].map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className={`checker-filter-chip ${spocTextFilter === filter.key ? 'active' : ''}`}
                    onClick={() => setSpocTextFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row spoc-review-search">
              <label>Search by title or book number</label>
              <input
                value={spocTextQuery}
                onChange={(event) => setSpocTextQuery(event.target.value)}
                placeholder="Search pending text reviews"
              />
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : spocTextTasks.length === 0 ? (
              <p>No text reviews pending.</p>
            ) : spocVisibleTextTasks.length === 0 ? (
              <p className="checker-empty-state">No SPOC text review tasks match this filter.</p>
            ) : (
              <div className="task-grid two-col-grid spoc-review-grid">
                {spocVisibleTextTasks.map((task) => {
                  const key = taskKey(task.bookId, task.versionId)
                  const form = formByKey[key] || {}
                  const isExpanded = expandedSpocTextTaskKey === key

                  return (
                    <article className={`task-card spoc-review-card ${isExpanded ? 'expanded' : 'compact'}`} key={`spoc-text-${key}`}>
                      <button
                        className="spoc-review-summary-btn"
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedSpocTextTaskKey((prev) => (prev === key ? '' : key))}
                      >
                        <div className="checker-vetting-head">
                          <h4>{task.title}{task.bookNumber ? ` - Book ${task.bookNumber}` : ''}</h4>
                          <span className={`checker-state-chip ${task.checkerFeedback ? 'revision' : 'pending'}`}>
                            {task.checkerFeedback ? 'Checker note available' : 'Ready for approval'}
                          </span>
                        </div>

                        <p className="checker-language-line">Language: {task.language}</p>
                        <p className="checker-meta-line">
                          Last update: {task.updatedAt ? new Date(task.updatedAt).toLocaleString() : 'Not available'}
                        </p>

                        <div className="spoc-review-status-row">
                          <StatusBadge label="Stage" value={task.stage} />
                          <StatusBadge label="Text" value={task.textStatus} />
                        </div>

                        <span className="spoc-review-expand-hint">
                          {isExpanded ? 'Hide full review' : 'Click to open full review'}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="spoc-review-body">
                          <div className="checker-link-row spoc-review-links">
                            {task.sourcePdfUrl ? (
                              <a href={task.sourcePdfUrl} target="_blank" rel="noreferrer">Open Hindi PDF</a>
                            ) : (
                              <span>Hindi PDF unavailable</span>
                            )}
                            {task.translatedTextUrl ? (
                              <a href={task.translatedTextUrl} target="_blank" rel="noreferrer">Open checker text</a>
                            ) : (
                              <span>Checker text link unavailable</span>
                            )}
                          </div>

                          {task.checkerFeedback && (
                            <p className="checker-existing-feedback"><strong>Checker note:</strong> {task.checkerFeedback}</p>
                          )}

                          <div className="form-row">
                            <label>Decision</label>
                            <select
                              value={form.decision || 'approved'}
                              onChange={(event) => updateFormField(task.bookId, task.versionId, 'decision', event.target.value)}
                            >
                              <option value="approved">approved</option>
                              <option value="rejected">rejected</option>
                            </select>
                          </div>
                          <div className="form-row">
                            <label>Feedback {(form.decision || 'approved') === 'rejected' ? '(required for rejection)' : '(optional)'}</label>
                            <textarea
                              rows="3"
                              value={form.feedback || ''}
                              onChange={(event) => updateFormField(task.bookId, task.versionId, 'feedback', event.target.value)}
                              placeholder="Add review note"
                            />
                          </div>

                          <button
                            className="mini-btn spoc-review-submit-btn"
                            type="button"
                            disabled={busyId === key}
                            onClick={() => onSubmitSpocTextReview(task)}
                          >
                            {busyId === key ? 'Saving...' : 'Done'}
                          </button>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="panel spoc-review-panel">
            <h3>SPOC Audio Final Approval</h3>
            {loading ? (
              <p>Loading...</p>
            ) : spocAudioTasks.length === 0 ? (
              <p>No audio final approvals pending.</p>
            ) : (
              <div className="task-grid two-col-grid spoc-review-grid">
                {spocAudioTasks.map((task) => {
                  const key = taskKey(task.bookId, task.versionId)
                  const form = formByKey[key] || {}
                  const isExpanded = expandedSpocAudioTaskKey === key

                  return (
                    <article className={`task-card spoc-review-card ${isExpanded ? 'expanded' : 'compact'}`} key={`spoc-audio-${key}`}>
                      <button
                        className="spoc-review-summary-btn"
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedSpocAudioTaskKey((prev) => (prev === key ? '' : key))}
                      >
                        <div className="checker-vetting-head">
                          <h4>{task.title}{task.bookNumber ? ` - Book ${task.bookNumber}` : ''}</h4>
                          <span className="checker-state-chip pending">Ready for final audio decision</span>
                        </div>

                        <p className="checker-language-line">Language: {task.language}</p>
                        <p className="checker-meta-line">
                          Last update: {task.updatedAt ? new Date(task.updatedAt).toLocaleString() : 'Not available'}
                        </p>

                        <div className="spoc-review-status-row">
                          <StatusBadge label="Stage" value={task.stage} />
                          <StatusBadge label="Audio" value={task.audioStatus} />
                        </div>

                        <span className="spoc-review-expand-hint">
                          {isExpanded ? 'Hide full review' : 'Click to open full review'}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="spoc-review-body">
                          <p>Feedback Window: {task.feedbackDeadline ? new Date(task.feedbackDeadline).toLocaleString() : 'Not set'}</p>

                          {Array.isArray(task.audioFiles) && task.audioFiles.length > 0 ? (
                            <div className="audio-review-files-list">
                              {task.audioFiles.map((url, index) => (
                                <div className="audio-review-player-wrap" key={`${url}-${index}`}>
                                  <audio controls preload="none" src={url} />
                                  <div className="audio-review-link-row">
                                    <a href={url} target="_blank" rel="noreferrer">Open audio {index + 1} in new tab</a>
                                    <span>{task.audioFiles.length === 1 ? 'Review full track before deciding' : `Track ${index + 1} of ${task.audioFiles.length}`}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : task.audioUrl ? (
                            <div className="audio-review-player-wrap">
                              <audio controls preload="none" src={task.audioUrl} />
                              <div className="audio-review-link-row">
                                <a href={task.audioUrl} target="_blank" rel="noreferrer">Open audio in new tab</a>
                                <span>Review full track before deciding</span>
                              </div>
                            </div>
                          ) : (
                            <p className="audio-review-note">Audio file link is unavailable for this task.</p>
                          )}

                          {task.checkerFeedback && (
                            <p className="checker-existing-feedback"><strong>Audio checker note:</strong> {task.checkerFeedback}</p>
                          )}

                          <div className="form-row">
                            <label>Decision</label>
                            <select
                              value={form.decision || 'approved'}
                              onChange={(event) => updateFormField(task.bookId, task.versionId, 'decision', event.target.value)}
                            >
                              <option value="approved">approved</option>
                              <option value="rejected">rejected</option>
                            </select>
                          </div>
                          <div className="form-row">
                            <label>Feedback {(form.decision || 'approved') === 'rejected' ? '(required for rejection)' : '(optional)'}</label>
                            <textarea
                              rows="3"
                              value={form.feedback || ''}
                              onChange={(event) => updateFormField(task.bookId, task.versionId, 'feedback', event.target.value)}
                              placeholder="Add SPOC note"
                            />
                          </div>

                          <button
                            className="mini-btn spoc-review-submit-btn"
                            type="button"
                            disabled={busyId === key}
                            onClick={() => onSubmitSpocAudioReview(task)}
                          >
                            {busyId === key ? 'Saving...' : 'Done'}
                          </button>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="panel">
            <h3>SPOC Blocker Control</h3>
            <div className="spoc-blocker-controls">
              <div className="form-row">
                <label>Select Book</label>
                <select
                  value={selectedBlockerTaskKey}
                  onChange={(event) => setSelectedBlockerTaskKey(event.target.value)}
                >
                  <option value="">Select a book to block</option>
                  {blockerSelectionOptions.map((task) => (
                    <option key={task.key} value={task.key}>
                      {task.title} | {task.language} | {(task.stage || '-').replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Reason</label>
                <input
                  value={blockerReason}
                  onChange={(event) => setBlockerReason(event.target.value)}
                  placeholder="Why is this book blocked?"
                />
              </div>

              <div className="row-actions">
                <button
                  className="mini-btn danger"
                  type="button"
                  onClick={onEnableSpocBlocker}
                  disabled={Boolean(busyId) || !selectedBlockerTaskKey || !blockerReason.trim()}
                >
                  Add To Blocker
                </button>
              </div>
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : spocBlockedTasks.length === 0 ? (
              <p>No books are currently blocked by SPOC.</p>
            ) : (
              <div className="task-grid two-col-grid">
                {spocBlockedTasks.map((task) => {
                  const key = taskKey(task.bookId, task.versionId)
                  return (
                    <article className="task-card" key={`spoc-block-${key}`}>
                      <div className="spoc-blocked-card-header">
                        <h4>{task.title}</h4>
                        <button
                          className="mini-btn unblock-btn"
                          type="button"
                          disabled={busyId === key}
                          onClick={() => submitTask({
                            bookId: task.bookId,
                            versionId: task.versionId,
                            endpoint: `/books/${task.bookId}/versions/${task.versionId}/blocker`,
                            method: 'put',
                            payload: {
                              isBlocked: false,
                              blockerNote: null
                            },
                            successMessage: 'Blocker removed.'
                          })}
                        >
                          {busyId === key ? 'Updating...' : 'Unblock'}
                        </button>
                      </div>
                      <p>Language: {task.language}</p>
                      <StatusBadge label="Stage" value={task.stage} />
                      <StatusBadge label="Blocker" value="blocked" />
                      <p className="spoc-blocker-reason"><strong>Reason:</strong> {task.blockerNote || 'Blocked by SPOC'}</p>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}

      {isRegional && (
        <section className="panel">
          <h3>Regional Team Feedback</h3>
          {loading ? (
            <p>Loading...</p>
          ) : regionalFeedbackTasks.length === 0 ? (
            <p>No open feedback tasks right now.</p>
          ) : (
            <div className="task-grid two-col-grid">
              {regionalFeedbackTasks.map((task) => {
                const key = taskKey(task.bookId, task.versionId)
                const form = formByKey[key] || {}
                return (
                  <article className="task-card" key={`regional-feedback-${key}`}>
                    <h4>{task.title}</h4>
                    <p>Language: {task.language}</p>
                    <p>Deadline: {new Date(task.feedbackDeadline).toLocaleString()}</p>
                    {task.audioUrl && (
                      <p>
                        <a href={task.audioUrl} target="_blank" rel="noreferrer">Open Audio</a>
                      </p>
                    )}

                    <div className="form-row">
                      <label>Rating</label>
                      <select
                        value={form.rating || '5'}
                        onChange={(event) => updateFormField(task.bookId, task.versionId, 'rating', event.target.value)}
                      >
                        <option value="5">5</option>
                        <option value="4">4</option>
                        <option value="3">3</option>
                        <option value="2">2</option>
                        <option value="1">1</option>
                      </select>
                    </div>

                    <div className="form-row">
                      <label>Feedback</label>
                      <input
                        value={form.text || ''}
                        onChange={(event) => updateFormField(task.bookId, task.versionId, 'text', event.target.value)}
                        placeholder="Write your feedback"
                      />
                    </div>

                    <button
                      className="mini-btn"
                      type="button"
                      disabled={busyId === key || !(form.text || '').trim()}
                      onClick={() => submitTask({
                        bookId: task.bookId,
                        versionId: task.versionId,
                        endpoint: `/feedback/books/${task.bookId}/versions/${task.versionId}`,
                        payload: {
                          rating: Number(form.rating || 5),
                          text: (form.text || '').trim()
                        },
                        successMessage: 'Feedback submitted successfully.'
                      })}
                    >
                      {busyId === key ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}
    </Navbar>
  )
}

export default WorkQueue
