import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

const normalizeUserRefId = (value) => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    if (value._id || value.id) return value._id || value.id
    if (typeof value.toString === 'function') {
      const candidate = value.toString()
      if (candidate && candidate !== '[object Object]') return candidate
    }
    return null
  }
  return null
}

const MyClaims = () => {
  const { user } = useAuth()
  const isChecker = user?.role === 'checker'
  const isRecorder = user?.role === 'recorder'
  const claimType = isRecorder ? 'audio' : 'checking'

  const [loading, setLoading] = useState(true)
  const [assigned, setAssigned] = useState([])
  const [available, setAvailable] = useState([])
  const [claimHistory, setClaimHistory] = useState([])
  const [historyBooks, setHistoryBooks] = useState([])
  const [notifications, setNotifications] = useState([])
  const [taskFilter, setTaskFilter] = useState('all')
  const [claimDaysByBook, setClaimDaysByBook] = useState({})
  const [checkerFeedbackByTask, setCheckerFeedbackByTask] = useState({})
  const [recorderAudioByTask, setRecorderAudioByTask] = useState({})
  const [checkerBusyId, setCheckerBusyId] = useState('')
  const [checkerActionMessage, setCheckerActionMessage] = useState('')

  const currentUserId = user?.id || user?._id || ''

  const isCurrentUser = useCallback(
    (value) => {
      if (!value || !currentUserId) return false
      return normalizeUserRefId(value)?.toString() === currentUserId.toString()
    },
    [currentUserId]
  )

  const formatDueIn = useCallback((value) => {
    if (!value) return 'No deadline'
    const now = Date.now()
    const due = new Date(value).getTime()
    if (Number.isNaN(due)) return 'No deadline'
    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`
    if (diffDays === 0) return 'Due today'
    return `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`
  }, [])

  const getClaimDays = useCallback((bookId) => {
    const raw = claimDaysByBook[bookId]
    const parsed = Number(raw)
    if (!Number.isInteger(parsed)) return 2
    return Math.min(30, Math.max(1, parsed))
  }, [claimDaysByBook])

  const updateClaimDays = useCallback((bookId, value) => {
    const parsed = Number(value)
    const bounded = Number.isInteger(parsed) ? Math.min(30, Math.max(1, parsed)) : 2
    setClaimDaysByBook((prev) => ({
      ...prev,
      [bookId]: bounded
    }))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setCheckerActionMessage('')
    try {
      const [assignedRes, availableRes, historyRes, notifRes] = await Promise.all([
        api.get('/books/my-assignments').catch(() => ({ data: [] })),
        api.get('/claims/available').catch(() => ({ data: [] })),
        api.get(`/claims/my-history?claimType=${claimType}&limit=200`).catch(() => ({ data: [] })),
        api.get('/notifications/my').catch(() => ({ data: { notifications: [] } }))
      ])

      const historyItems = Array.isArray(historyRes.data) ? historyRes.data : []
      const uniqueHistoryBookIds = [
        ...new Set(
          historyItems
            .map((item) => normalizeUserRefId(item.book))
            .filter(Boolean)
        )
      ]

      const shouldLoadHistoryBooks = isChecker && uniqueHistoryBookIds.length > 0
      const detailedHistoryBooks = shouldLoadHistoryBooks
        ? await Promise.all(
          uniqueHistoryBookIds.map((bookId) => api.get(`/books/${bookId}`).catch(() => null))
        )
        : []

      setAssigned(Array.isArray(assignedRes.data) ? assignedRes.data : [])
      setAvailable(Array.isArray(availableRes.data) ? availableRes.data : [])
      setClaimHistory(historyItems)
      setHistoryBooks(detailedHistoryBooks.map((item) => item?.data).filter(Boolean))
      setNotifications(Array.isArray(notifRes.data.notifications) ? notifRes.data.notifications : [])
    } catch (error) {
      setCheckerActionMessage(error?.response?.data?.message || 'Failed to load your claims.')
    } finally {
      setLoading(false)
    }
  }, [claimType, isChecker])

  useEffect(() => {
    load()
  }, [load])

  const checkerClaimLookup = useMemo(() => {
    const lookup = new Set()
    claimHistory.forEach((claim) => {
      if (claim?.claimType !== 'checking') return
      if (claim?.status !== 'submitted') return
      const bookId = normalizeUserRefId(claim.book)
      const language = claim?.language
      if (!bookId || !language) return
      lookup.add(`${bookId}:${language}`)
    })
    return lookup
  }, [claimHistory])

  const checkerTasks = useMemo(() => {
    if (!isChecker) return []

    const byKey = new Map()

    assigned.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        if (!isCurrentUser(version.assignedChecker)) return
        if (version.currentStage !== 'checking') return

        const key = `${book._id}:${version._id}`
        const status = version.textStatus === 'checking_in_progress' ? 'in_review' : 'pending_start'

        byKey.set(key, {
          key,
          bookId: book._id,
          versionId: version._id,
          title: book.title,
          language: version.language || user?.language || '-',
          bookNumber: book.bookNumber,
          deadline: version.checkerDeadline,
          status,
          progress: status === 'in_review' ? 60 : 20,
          translatorName: version.assignedTranslator?.name || 'Unassigned',
          sourcePdfUrl: book.originalPdfUrl || '',
          translatedTextUrl: version.textFileUrl || '',
          canAct: version.textStatus === 'checking_in_progress',
          feedback: version.feedback || '',
          updatedAt: version.updatedAt || book.updatedAt
        })
      })
    })

    historyBooks.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        if (user?.language && version.language !== user.language) return
        if (version.currentStage !== 'translation') return
        if (version.textStatus !== 'translation_in_progress') return
        if (!version.feedback || (version.reassignmentCount || 0) <= 0) return

        const hasCheckerOwnership =
          isCurrentUser(version.lastCheckedBy) ||
          checkerClaimLookup.has(`${book._id?.toString()}:${version.language}`)

        if (!hasCheckerOwnership) return

        const key = `${book._id}:${version._id}`
        if (byKey.has(key)) return

        byKey.set(key, {
          key,
          bookId: book._id,
          versionId: version._id,
          title: book.title,
          language: version.language,
          bookNumber: book.bookNumber,
          deadline: version.translatorDeadline,
          status: 'revision_sent',
          progress: 100,
          translatorName: version.assignedTranslator?.name || 'Unassigned',
          sourcePdfUrl: book.originalPdfUrl || '',
          translatedTextUrl: version.textFileUrl || '',
          canAct: false,
          feedback: version.feedback || '',
          updatedAt: version.updatedAt || book.updatedAt
        })
      })
    })

    const order = { in_review: 0, pending_start: 1, revision_sent: 2 }
    return Array.from(byKey.values()).sort((a, b) => {
      const orderDiff = (order[a.status] ?? 9) - (order[b.status] ?? 9)
      if (orderDiff !== 0) return orderDiff
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    })
  }, [assigned, checkerClaimLookup, historyBooks, isChecker, isCurrentUser, user?.language])

  const recorderTasks = useMemo(() => {
    if (!isRecorder) return []

    const tasks = []

    assigned.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        if (!isCurrentUser(version.assignedRecorder)) return
        if (version.currentStage !== 'audio_generation') return

        const key = `${book._id}:${version._id}`
        const status = version.audioStatus === 'audio_generated' ? 'in_review' : 'pending_start'

        tasks.push({
          key,
          bookId: book._id,
          versionId: version._id,
          title: book.title,
          language: version.language || user?.language || '-',
          bookNumber: book.bookNumber,
          deadline: version.recorderDeadline,
          status,
          progress: status === 'in_review' ? 60 : 20,
          sourcePdfUrl: book.originalPdfUrl || '',
          translatedTextUrl: version.textFileUrl || '',
          feedback: version.feedback || '',
          canAct: version.audioStatus === 'audio_generated',
          actionLabel: version.audioStatus === 'audio_generated'
            ? 'Ready for audio submission'
            : 'Waiting for audio generation readiness',
          updatedAt: version.updatedAt || book.updatedAt
        })
      })
    })

    const order = { in_review: 0, pending_start: 1 }
    return tasks.sort((a, b) => {
      const orderDiff = (order[a.status] ?? 9) - (order[b.status] ?? 9)
      if (orderDiff !== 0) return orderDiff
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    })
  }, [assigned, isCurrentUser, isRecorder, user?.language])

  const visibleTasks = useMemo(() => {
    const sourceTasks = isRecorder ? recorderTasks : checkerTasks

    if (taskFilter === 'all') return sourceTasks

    if (!isRecorder && taskFilter === 'revision_sent') {
      return sourceTasks.filter((task) => task.status === 'revision_sent')
    }
    return sourceTasks.filter((task) => task.status === 'in_review' || task.status === 'pending_start')
  }, [checkerTasks, isRecorder, recorderTasks, taskFilter])

  const availableTasks = useMemo(() => {
    return (Array.isArray(available) ? available : [])
      .filter((item) => item?.claimType === claimType && item?.version)
      .map((item) => ({
        key: `${item._id}:${item.version._id}`,
        bookId: item._id,
        versionId: item.version._id,
        title: item.title,
        bookNumber: item.bookNumber,
        description: item.description,
        language: item.version.language,
        stage: item.version.currentStage
      }))
      .filter((item) => !user?.language || item.language === user.language)
  }, [available, claimType, user?.language])

  const hasActiveTask = useMemo(() => {
    const sourceTasks = isRecorder ? recorderTasks : checkerTasks
    return sourceTasks.some((task) => task.status === 'in_review' || task.status === 'pending_start')
  }, [checkerTasks, isRecorder, recorderTasks])

  const onClaimAvailableTask = useCallback(
    async (task) => {
      if (!task?.bookId || !task?.language) return

      const daysCommitted = getClaimDays(task.bookId)
      setCheckerBusyId(`claim:${task.bookId}`)
      setCheckerActionMessage('')

      try {
        await api.post(`/claims/books/${task.bookId}/claim`, {
          language: task.language,
          claimType,
          daysCommitted
        })

        await load()
      } catch (claimError) {
        setCheckerActionMessage(claimError?.response?.data?.message || 'Failed to claim task.')
      } finally {
        setCheckerBusyId('')
      }
    },
    [claimType, getClaimDays, load]
  )

  const onCheckerDecision = useCallback(
    async (task, decision) => {
      if (!task?.canAct) return

      const feedback = (checkerFeedbackByTask[task.key] || '').trim()
      if (decision === 'revision' && !feedback) {
        setCheckerActionMessage('Please add correction feedback before sending for revision.')
        return
      }

      setCheckerBusyId(task.key)
      setCheckerActionMessage('')
      try {
        await api.post(`/books/${task.bookId}/versions/${task.versionId}/submit-vetted-text`, {
          decision,
          feedback: feedback || null,
          textFileUrl: task.translatedTextUrl || null
        })

        setCheckerActionMessage(
          decision === 'approved'
            ? 'Translated text approved and sent to SPOC.'
            : 'Corrections sent to translator for reassignment.'
        )

        setCheckerFeedbackByTask((prev) => ({ ...prev, [task.key]: '' }))
        await load()
      } catch (submitError) {
        setCheckerActionMessage(submitError?.response?.data?.message || 'Failed to submit checker decision.')
      } finally {
        setCheckerBusyId('')
      }
    },
    [checkerFeedbackByTask, load]
  )

  const onRecorderSubmit = useCallback(
    async (task) => {
      if (!task?.canAct) return

      const audioUrl = (recorderAudioByTask[task.key] || '').trim()
      if (!audioUrl) {
        setCheckerActionMessage('Please provide audio MP3 URL before submitting.')
        return
      }

      setCheckerBusyId(task.key)
      setCheckerActionMessage('')
      try {
        await api.post(`/books/${task.bookId}/versions/${task.versionId}/submit-audio`, {
          audioUrl
        })

        setCheckerActionMessage('Audio submitted successfully and sent to audio checking stage.')
        setRecorderAudioByTask((prev) => ({ ...prev, [task.key]: '' }))
        await load()
      } catch (submitError) {
        setCheckerActionMessage(submitError?.response?.data?.message || 'Failed to submit audio.')
      } finally {
        setCheckerBusyId('')
      }
    },
    [load, recorderAudioByTask]
  )

  if (!isChecker && !isRecorder) {
    return (
      <Navbar notifications={notifications.filter((item) => !item.isRead).length}>
        <section className="panel">
          <p>This page is only available for text checker and recorder roles.</p>
        </section>
      </Navbar>
    )
  }

  const pageDescription = isRecorder
    ? 'Track your claimed audio-generation tasks and submit final MP3 links.'
    : 'Track your claimed text-vetting tasks and submit review decisions.'

  const assignedHeading = isRecorder ? 'My assigned audio tasks' : 'My assigned tasks'
  const availableHeading = isRecorder ? 'Available tasks (Audio Generation)' : 'Available tasks (Text Vetting)'
  const languageLinePrefix = isRecorder ? 'Language' : 'Hindi ->'
  const filterOptions = isRecorder
    ? [
      { key: 'all', label: 'All' },
      { key: 'in_review', label: 'In progress' }
    ]
    : [
      { key: 'all', label: 'All' },
      { key: 'in_review', label: 'In review' },
      { key: 'revision_sent', label: 'Revision sent' }
    ]
  const activeEmptyText = isRecorder
    ? 'No audio-generation tasks found for this filter.'
    : 'No text-vetting tasks found for this filter.'
  const availableEmptyText = isRecorder
    ? 'No books are currently available for audio generation claim.'
    : 'No books are currently available for text vetting claim.'

  return (
    <Navbar notifications={notifications.filter((item) => !item.isRead).length}>
      <section className="dashboard-head checker-page-head">
        <h2>My Claims</h2>
        <p>{pageDescription}</p>
      </section>

      <section className="panel checker-claims-panel">
        <div className="checker-section-head">
          <h3>{assignedHeading}</h3>
          <span>{visibleTasks.length} shown</span>
          <div className="checker-task-filters">
            {filterOptions.map((filter) => (
              <button
                type="button"
                key={filter.key}
                className={`checker-filter-chip ${taskFilter === filter.key ? 'active' : ''}`}
                onClick={() => setTaskFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {checkerActionMessage && <p className="checker-inline-message">{checkerActionMessage}</p>}

        {loading ? (
          <p>Loading...</p>
        ) : visibleTasks.length > 0 ? (
          <div className="task-grid checker-vetting-grid">
            {visibleTasks.map((task) => (
              <article className={`task-card checker-vetting-card is-${task.status}`} key={task.key}>
                <div className="checker-vetting-head">
                  <h4>
                    {task.title}
                    {task.bookNumber ? ` - Book ${task.bookNumber}` : ''}
                  </h4>
                  <span
                    className={`checker-state-chip ${
                      task.status === 'in_review'
                        ? 'active'
                        : task.status === 'pending_start'
                          ? 'pending'
                          : 'revision'
                    }`}
                  >
                    {task.status === 'in_review'
                      ? (isRecorder ? 'In progress' : 'In review')
                      : task.status === 'pending_start'
                        ? 'Pending start'
                        : 'Revision sent'}
                  </span>
                </div>

                <p className="checker-language-line">
                  {isRecorder ? `${languageLinePrefix}: ${task.language}` : `${languageLinePrefix} ${task.language}`}
                </p>
                <p className="checker-meta-line">
                  {isRecorder
                    ? formatDueIn(task.deadline)
                    : `${formatDueIn(task.deadline)} | Translator: ${task.translatorName}`}
                </p>

                <div className="checker-progress-row">
                  <span>Review progress</span>
                  <strong>{task.progress}%</strong>
                </div>
                <div className="checker-progress-bar">
                  <div style={{ width: `${task.progress}%` }} />
                </div>

                {task.feedback && (
                  <div className="checker-existing-feedback">
                    <strong>{isRecorder ? 'Latest SPOC note:' : 'Last feedback:'}</strong> {task.feedback}
                  </div>
                )}

                {task.canAct && !isRecorder && (
                  <div className="form-row">
                    <label>Feedback for translator (required for revision)</label>
                    <textarea
                      rows="3"
                      value={checkerFeedbackByTask[task.key] || ''}
                      onChange={(event) => setCheckerFeedbackByTask((prev) => ({ ...prev, [task.key]: event.target.value }))}
                      placeholder="Write corrections if text needs revision"
                    />
                  </div>
                )}

                {task.canAct && isRecorder && (
                  <div className="form-row">
                    <label>Audio MP3 URL</label>
                    <input
                      value={recorderAudioByTask[task.key] || ''}
                      onChange={(event) => setRecorderAudioByTask((prev) => ({ ...prev, [task.key]: event.target.value }))}
                      placeholder="https://drive.google.com/... or .mp3 link"
                    />
                  </div>
                )}

                <div className="row-actions checker-review-actions">
                  {task.sourcePdfUrl ? (
                    <a className="mini-btn checker-action-link" href={task.sourcePdfUrl} target="_blank" rel="noreferrer">
                      View Hindi PDF
                    </a>
                  ) : (
                    <span className="mini-btn checker-action-link" aria-disabled="true">Hindi PDF unavailable</span>
                  )}
                  {task.translatedTextUrl ? (
                    <a className="mini-btn checker-action-link" href={task.translatedTextUrl} target="_blank" rel="noreferrer">
                      View text
                    </a>
                  ) : (
                    <span className="mini-btn checker-action-link" aria-disabled="true">Text file unavailable</span>
                  )}

                  {task.canAct && !isRecorder && (
                    <>
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={() => onCheckerDecision(task, 'approved')}
                        disabled={checkerBusyId === task.key}
                      >
                        Approve and send to SPOC
                      </button>
                      <button
                        type="button"
                        className="mini-btn danger"
                        onClick={() => onCheckerDecision(task, 'revision')}
                        disabled={checkerBusyId === task.key}
                      >
                        Send for revision
                      </button>
                    </>
                  )}

                  {task.canAct && isRecorder && (
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => onRecorderSubmit(task)}
                      disabled={checkerBusyId === task.key || !(recorderAudioByTask[task.key] || '').trim()}
                    >
                      {checkerBusyId === task.key ? 'Submitting...' : 'Submit Audio'}
                    </button>
                  )}
                </div>

                {!task.canAct && <p className="checker-meta-line">{task.actionLabel}</p>}
              </article>
            ))}
          </div>
        ) : (
          <p className="checker-empty-state">{activeEmptyText}</p>
        )}
      </section>

      <section className="panel checker-claim-panel">
        <div className="checker-section-head">
          <h3>{availableHeading}</h3>
          <span>{availableTasks.length} shown</span>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : availableTasks.length > 0 ? (
          <div className="task-grid checker-claim-grid">
            {availableTasks.map((task) => (
              <article className="task-card checker-claim-card" key={task.key}>
                <h4>
                  {task.title}
                  {task.bookNumber ? ` - Book ${task.bookNumber}` : ''}
                </h4>
                <p className="checker-language-line">
                  {isRecorder ? `${languageLinePrefix}: ${task.language}` : `${languageLinePrefix} ${task.language}`}
                </p>
                <p className="checker-meta-line">Stage: {task.stage.replace('_', ' ')}</p>
                {task.description ? <p>{task.description}</p> : null}

                <div className="form-row">
                  <label htmlFor={`claim-days-${task.bookId}`}>Set deadline (days)</label>
                  <input
                    id={`claim-days-${task.bookId}`}
                    type="number"
                    min="1"
                    max="30"
                    value={getClaimDays(task.bookId)}
                    onChange={(event) => updateClaimDays(task.bookId, event.target.value)}
                  />
                </div>

                <div className="row-actions">
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => onClaimAvailableTask(task)}
                    disabled={checkerBusyId === `claim:${task.bookId}` || hasActiveTask}
                  >
                    Claim
                  </button>
                </div>
                {hasActiveTask ? (
                  <p className="checker-meta-line">Complete your current assigned task before claiming a new one.</p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="checker-empty-state">{availableEmptyText}</p>
        )}
      </section>

    </Navbar>
  )
}

export default MyClaims
