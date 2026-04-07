import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

const Notifications = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const response = await api.get('/notifications/my')
      setNotifications(Array.isArray(response.data?.notifications) ? response.data.notifications : [])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  )

  const feedbackAlertsCount = useMemo(() => {
    if (user?.role !== 'translator') return 0
    return notifications.filter((item) => {
      const text = `${item.title || ''} ${item.message || ''}`.toLowerCase()
      return item.type === 'feedback' || /feedback|revision|rejected/.test(text)
    }).length
  }, [notifications, user?.role])

  const reassignmentAlertsCount = useMemo(() => {
    if (user?.role !== 'translator') return 0
    return notifications.filter((item) => {
      const text = `${item.title || ''} ${item.message || ''}`.toLowerCase()
      return /reassign|reassigned|blocker|reopen|reopened/.test(text)
    }).length
  }, [notifications, user?.role])

  const onMarkOneRead = async (notificationId) => {
    setBusyId(`read:${notificationId}`)
    try {
      await api.put(`/notifications/${notificationId}/read`)
      setNotifications((prev) => prev.map((item) => (
        item._id === notificationId ? { ...item, isRead: true } : item
      )))
    } finally {
      setBusyId('')
    }
  }

  const onMarkAllRead = async () => {
    setBusyId('all')
    try {
      await api.put('/notifications/read-all')
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
    } finally {
      setBusyId('')
    }
  }

  const onDeleteOne = async (notificationId) => {
    setBusyId(`delete:${notificationId}`)
    try {
      await api.delete(`/notifications/${notificationId}`)
      setNotifications((prev) => prev.filter((item) => item._id !== notificationId))
    } finally {
      setBusyId('')
    }
  }

  const onAutoDeleteOld = async () => {
    setBusyId('cleanup')
    setNotice('')
    try {
      const response = await api.delete('/notifications/cleanup/old', {
        params: { days: 30, readOnly: true }
      })

      const deletedCount = Number(response.data?.deletedCount || 0)
      setNotice(`${deletedCount} old read notification(s) deleted.`)
      await loadNotifications()
    } finally {
      setBusyId('')
    }
  }

  return (
    <Navbar notifications={unreadCount}>
      <section className="dashboard-head">
        <h2>Notifications</h2>
        <p>All updates related to tasks, deadlines, reviews, and system activity.</p>
      </section>

      {user?.role === 'translator' && (
        <section className="panel">
          <h3>Alerts & Issues</h3>
          <div className="translator-alert-links">
            <button
              type="button"
              className="alert-box warning alert-link-btn"
              onClick={() => navigate('/translator-feedback?view=feedback')}
            >
              Feedback updates: {feedbackAlertsCount} item(s). Click to open feedback section.
            </button>
            <button
              type="button"
              className="alert-box danger alert-link-btn"
              onClick={() => navigate('/translator-feedback?view=reassignment')}
            >
              Reassignment alerts: {reassignmentAlertsCount} item(s). Click for reassignment details.
            </button>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="row-actions">
          <button
            type="button"
            className="mini-btn"
            onClick={onMarkAllRead}
            disabled={busyId === 'all' || unreadCount === 0}
          >
            {busyId === 'all' ? 'Marking...' : 'Mark All As Read'}
          </button>
          <button
            type="button"
            className="mini-btn danger"
            onClick={onAutoDeleteOld}
            disabled={busyId === 'cleanup'}
          >
            {busyId === 'cleanup' ? 'Cleaning...' : 'Auto-delete Old Read (30d)'}
          </button>
        </div>

        {notice && <p className="analytics-note">{notice}</p>}

        {loading ? (
          <p>Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <p>No notifications yet.</p>
        ) : (
          <ul className="activity-list">
            {notifications.map((item) => (
              <li key={item._id} className="notification-item">
                <button
                  type="button"
                  className="notif-delete-btn"
                  disabled={busyId === `delete:${item._id}`}
                  onClick={() => onDeleteOne(item._id)}
                  aria-label="Delete notification"
                  title="Delete"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9z" fill="currentColor" />
                  </svg>
                </button>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <p>
                  {new Date(item.createdAt).toLocaleString()} | {item.type}
                </p>
                <div className="row-actions">
                  {!item.isRead && (
                    <button
                      type="button"
                      className="mini-btn"
                      disabled={busyId === `read:${item._id}`}
                      onClick={() => onMarkOneRead(item._id)}
                    >
                      {busyId === `read:${item._id}` ? 'Updating...' : 'Mark As Read'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Navbar>
  )
}

export default Notifications
