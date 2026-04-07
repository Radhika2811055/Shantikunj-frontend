import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

const TranslatorFeedback = () => {
  const { user } = useAuth()
  const currentUserId = user?.id || user?._id || ''
  const [searchParams] = useSearchParams()
  const [assigned, setAssigned] = useState([])
  const [feedbackList, setFeedbackList] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const isCurrentUser = useCallback((value) => {
    if (!value || !currentUserId) return false

    const normalized = value?._id || value
    return normalized?.toString() === currentUserId.toString()
  }, [currentUserId])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [assignedRes, notifRes] = await Promise.all([
          api.get('/books/my-assignments').catch(() => ({ data: [] })),
          api.get('/notifications/my').catch(() => ({ data: { notifications: [] } }))
        ])

        setAssigned(Array.isArray(assignedRes.data) ? assignedRes.data : [])
        setNotifications(Array.isArray(notifRes.data?.notifications) ? notifRes.data.notifications : [])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const translatorVersions = useMemo(() => {
    if (user?.role !== 'translator') return []

    const rows = []
    assigned.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        if (!isCurrentUser(version.assignedTranslator)) return
        rows.push({
          bookId: book._id,
          versionId: version._id,
          bookTitle: book.title,
          language: version.language,
          currentStage: version.currentStage,
          textStatus: version.textStatus,
          feedback: version.feedback || '',
          blockerNote: version.blockerNote || '',
          reassignmentCount: version.reassignmentCount || 0,
          updatedAt: version.updatedAt
        })
      })
    })

    return rows.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
  }, [assigned, isCurrentUser, user?.role])

  useEffect(() => {
    let cancelled = false

    const loadFeedback = async () => {
      if (translatorVersions.length === 0) {
        setFeedbackList([])
        return
      }

      const responses = await Promise.all(
        translatorVersions.slice(0, 30).map((item) =>
          api
            .get(`/feedback/books/${item.bookId}/versions/${item.versionId}`)
            .then((resp) => ({ item, list: Array.isArray(resp.data) ? resp.data : [] }))
            .catch(() => ({ item, list: [] }))
        )
      )

      if (cancelled) return

      const merged = responses.flatMap(({ item, list }) =>
        list.map((entry) => ({
          ...entry,
          bookTitle: item.bookTitle,
          language: item.language,
          versionId: item.versionId
        }))
      )

      setFeedbackList(merged)
    }

    loadFeedback()

    return () => {
      cancelled = true
    }
  }, [translatorVersions])

  useEffect(() => {
    const view = searchParams.get('view')
    if (!view) return
    const target = document.getElementById(view === 'reassignment' ? 'reassignment-section' : 'feedback-section')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [searchParams])

  const reassignmentItems = useMemo(
    () => translatorVersions.filter((item) => item.reassignmentCount > 0 || Boolean(item.feedback) || Boolean(item.blockerNote)),
    [translatorVersions]
  )

  const sortedFeedback = useMemo(
    () => [...feedbackList].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    [feedbackList]
  )

  const unreadCount = notifications.filter((item) => !item.isRead).length

  return (
    <Navbar notifications={unreadCount}>
      <section className="dashboard-head">
        <h2>Feedback and Reassignment</h2>
        <p>See reviewer feedback and reassigned translation tasks in one place.</p>
      </section>

      <section className="stat-grid translator-metric-grid">
        <article className="stat-card">
          <h3>Total Feedback Notes</h3>
          <strong>{sortedFeedback.length}</strong>
        </article>
        <article className="stat-card">
          <h3>Reassignment Alerts</h3>
          <strong>{reassignmentItems.length}</strong>
        </article>
      </section>

      <section className="panel" id="feedback-section">
        <h3>Feedback Review</h3>
        {loading ? (
          <p>Loading feedback...</p>
        ) : sortedFeedback.length === 0 ? (
          <p>No feedback available yet for your translated books.</p>
        ) : (
          <div className="task-grid two-col-grid">
            {sortedFeedback.map((item) => (
              <article className="task-card" key={item._id}>
                <h4>{item.bookTitle}</h4>
                <p>Language: {item.language}</p>
                <p>Reviewer: {item.reviewer?.name || 'Team Member'} ({item.reviewer?.role || 'member'})</p>
                <p>Rating: {item.rating}/5</p>
                <p>{item.text}</p>
                <p>Updated: {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel" id="reassignment-section">
        <h3>Reassignment With Notes</h3>
        {loading ? (
          <p>Loading reassignment items...</p>
        ) : reassignmentItems.length === 0 ? (
          <p>No reassignment notes yet.</p>
        ) : (
          <div className="task-grid two-col-grid">
            {reassignmentItems.map((item) => (
              <article className="task-card" key={item.versionId}>
                <h4>{item.bookTitle}</h4>
                <p>Language: {item.language}</p>
                <p>Stage: {item.currentStage}</p>
                <p>Text Status: {item.textStatus}</p>
                <p>Reassignment Count: {item.reassignmentCount}</p>
                <p>Feedback Note: {item.feedback || 'No direct feedback note'}</p>
                <p>Blocker Note: {item.blockerNote || 'No blocker note'}</p>
                <p>Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'N/A'}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </Navbar>
  )
}

export default TranslatorFeedback
