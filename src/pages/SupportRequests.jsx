import { useCallback, useEffect, useMemo, useState } from 'react'
import { getApiErrorMessage } from '../api/errorParser'
import { notificationsService, supportService } from '../api/services'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

const isManagementRole = (role) => ['admin', 'spoc'].includes(role)

const SupportRequests = () => {
  const { user } = useAuth()
  const canManage = isManagementRole(user?.role)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [notifications, setNotifications] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [allRequests, setAllRequests] = useState([])
  const [form, setForm] = useState({
    subject: '',
    message: '',
    category: 'workflow',
    priority: 'medium'
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [myRes, allRes, notifRes] = await Promise.all([
        supportService.myRequests().catch(() => ({ data: [] })),
        canManage ? supportService.allRequests().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        notificationsService.myNotifications().catch(() => ({ data: { notifications: [] } }))
      ])

      setMyRequests(Array.isArray(myRes.data) ? myRes.data : [])
      setAllRequests(Array.isArray(allRes.data) ? allRes.data : [])
      setNotifications(Array.isArray(notifRes.data?.notifications) ? notifRes.data.notifications : [])
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Failed to load support requests.'))
    } finally {
      setLoading(false)
    }
  }, [canManage])

  useEffect(() => {
    load()
  }, [load])

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  )

  const onCreateRequest = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!form.subject.trim() || !form.message.trim()) {
      setError('Subject and message are required.')
      return
    }

    setSubmitting(true)
    try {
      await supportService.create({
        subject: form.subject.trim(),
        message: form.message.trim(),
        category: form.category,
        priority: form.priority
      })

      setForm({
        subject: '',
        message: '',
        category: 'workflow',
        priority: 'medium'
      })
      setMessage('Support request created successfully.')
      await load()
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Failed to create support request.'))
    } finally {
      setSubmitting(false)
    }
  }

  const onUpdateStatus = async (requestId, status) => {
    setUpdatingId(requestId)
    setMessage('')
    setError('')

    try {
      await supportService.updateStatus(requestId, { status })
      setMessage(`Request status updated to ${status}.`)
      await load()
    } catch (updateError) {
      setError(getApiErrorMessage(updateError, 'Failed to update request status.'))
    } finally {
      setUpdatingId('')
    }
  }

  return (
    <Navbar notifications={unreadCount}>
      <section className="dashboard-head">
        <h2>Support Center</h2>
        <p>Create support requests and track status updates.</p>
      </section>

      {(message || error) && (
        <section className="panel">
          {message && <div className="ok-box">{message}</div>}
          {error && <div className="error-box">{error}</div>}
        </section>
      )}

      <section className="panel">
        <h3>Create Support Request</h3>
        <form className="translator-upload-form" onSubmit={onCreateRequest}>
          <div className="form-row">
            <label>Subject</label>
            <input
              value={form.subject}
              onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Brief summary"
              required
            />
          </div>

          <div className="translator-upload-grid">
            <div className="form-row">
              <label>Category</label>
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              >
                <option value="workflow">Workflow</option>
                <option value="upload">Upload</option>
                <option value="auth">Authentication</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-row">
              <label>Priority</label>
              <select
                value={form.priority}
                onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <label>Message</label>
            <textarea
              rows={4}
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              placeholder="Describe your issue"
              required
            />
          </div>

          <button className="mini-btn" type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Create Request'}
          </button>
        </form>
      </section>

      <section className="panel">
        <h3>My Requests</h3>
        {loading ? (
          <p>Loading...</p>
        ) : myRequests.length === 0 ? (
          <p>No support requests created yet.</p>
        ) : (
          <ul className="activity-list">
            {myRequests.map((item) => (
              <li key={item._id}>
                <strong>{item.subject || 'Support request'}</strong>
                <p>{item.message || '-'}</p>
                <p>Category: {item.category || '-'} | Priority: {item.priority || '-'} | Status: {item.status || '-'}</p>
                <p>Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'N/A'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && (
        <section className="panel">
          <h3>Manage All Requests</h3>
          {loading ? (
            <p>Loading...</p>
          ) : allRequests.length === 0 ? (
            <p>No support requests available.</p>
          ) : (
            <div className="task-grid two-col-grid">
              {allRequests.map((item) => (
                <article className="task-card" key={item._id}>
                  <h4>{item.subject || 'Support request'}</h4>
                  <p>{item.message || '-'}</p>
                  <p>Requested by: {item.requestedBy?.name || item.requestedBy?.email || '-'}</p>
                  <p>Language: {item.requestedBy?.language || item.language || '-'}</p>
                  <p>Status: {item.status || '-'}</p>
                  <div className="row-actions">
                    {['open', 'in_progress', 'resolved', 'closed'].map((status) => (
                      <button
                        key={`${item._id}-${status}`}
                        type="button"
                        className="mini-btn"
                        disabled={updatingId === item._id || item.status === status}
                        onClick={() => onUpdateStatus(item._id, status)}
                      >
                        {updatingId === item._id ? 'Updating...' : status.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </Navbar>
  )
}

export default SupportRequests
