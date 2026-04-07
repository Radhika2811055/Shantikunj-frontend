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

const RecorderFeedback = () => {
  const { user } = useAuth()
  const currentUserId = user?.id || user?._id || ''

  const [loading, setLoading] = useState(true)
  const [assigned, setAssigned] = useState([])
  const [notifications, setNotifications] = useState([])

  const isCurrentUser = useCallback((value) => {
    if (!value || !currentUserId) return false
    return normalizeUserRefId(value)?.toString() === currentUserId.toString()
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

  const feedbackItems = useMemo(() => {
    if (user?.role !== 'recorder') return []

    const rows = []

    assigned.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        if (!isCurrentUser(version.assignedRecorder)) return
        if (version.currentStage !== 'audio_generation') return
        if (version.audioStatus !== 'audio_generated') return

        const feedback = (version.feedback || '').trim()
        if (!feedback) return

        rows.push({
          key: `${book._id}:${version._id}`,
          title: book.title,
          bookNumber: book.bookNumber,
          language: version.language,
          feedback,
          updatedAt: version.updatedAt || book.updatedAt
        })
      })
    })

    return rows.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
  }, [assigned, isCurrentUser, user?.role])

  const unreadCount = notifications.filter((item) => !item.isRead).length

  return (
    <Navbar notifications={unreadCount}>
      <section className="dashboard-head">
        <h2>Audio Feedback</h2>
        <p>Only feedback received from audio vetting is shown here.</p>
      </section>

      <section className="panel">
        <h3>Received Feedback</h3>
        {loading ? (
          <p>Loading recorder feedback...</p>
        ) : feedbackItems.length === 0 ? (
          <p>No audio feedback received right now.</p>
        ) : (
          <div className="task-grid two-col-grid">
            {feedbackItems.map((item) => (
              <article className="task-card" key={item.key}>
                <h4>
                  {item.title}
                  {item.bookNumber ? ` - Book ${item.bookNumber}` : ''}
                </h4>
                <p>Language: {item.language}</p>
                <p className="checker-existing-feedback">
                  <strong>Audio checker feedback:</strong> {item.feedback}
                </p>
                <p>Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'N/A'}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </Navbar>
  )
}

export default RecorderFeedback
