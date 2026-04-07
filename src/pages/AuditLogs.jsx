import { useCallback, useEffect, useMemo, useState } from 'react'
import { getApiErrorMessage } from '../api/errorParser'
import { auditService, notificationsService } from '../api/services'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

const AuditLogs = () => {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    language: user?.role === 'spoc' ? user?.language || '' : '',
    action: '',
    limit: 100
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = {
        limit: Number(filters.limit) || 100
      }

      if (filters.language.trim()) params.language = filters.language.trim()
      if (filters.action.trim()) params.action = filters.action.trim()

      const [auditRes, notifRes] = await Promise.all([
        auditService.list(params),
        notificationsService.myNotifications().catch(() => ({ data: { notifications: [] } }))
      ])

      const payload = auditRes.data
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.logs)
          ? payload.logs
          : []

      setLogs(rows)
      setNotifications(Array.isArray(notifRes.data?.notifications) ? notifRes.data.notifications : [])
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Failed to load audit logs.'))
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [filters.action, filters.language, filters.limit])

  useEffect(() => {
    load()
  }, [load])

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  )

  return (
    <Navbar notifications={unreadCount}>
      <section className="dashboard-head">
        <h2>Audit Logs</h2>
        <p>Track workflow actions with language-aware filtering.</p>
      </section>

      <section className="panel">
        <h3>Filters</h3>
        <div className="translator-upload-grid">
          <div className="form-row">
            <label>Language</label>
            <input
              value={filters.language}
              onChange={(event) => setFilters((prev) => ({ ...prev, language: event.target.value }))}
              placeholder="e.g. Hindi"
              readOnly={user?.role === 'spoc'}
            />
          </div>
          <div className="form-row">
            <label>Action</label>
            <input
              value={filters.action}
              onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value }))}
              placeholder="e.g. submit_translation"
            />
          </div>
          <div className="form-row">
            <label>Limit</label>
            <input
              type="number"
              min={10}
              max={500}
              value={filters.limit}
              onChange={(event) => setFilters((prev) => ({ ...prev, limit: event.target.value }))}
            />
          </div>
        </div>
        <div className="row-actions">
          <button type="button" className="mini-btn" onClick={load} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh Logs'}
          </button>
        </div>
      </section>

      {error && (
        <section className="panel">
          <div className="error-box">{error}</div>
        </section>
      )}

      <section className="panel">
        <h3>Entries ({logs.length})</h3>
        {loading ? (
          <p>Loading...</p>
        ) : logs.length === 0 ? (
          <p>No audit entries found for the selected filters.</p>
        ) : (
          <ul className="activity-list">
            {logs.map((entry, index) => (
              <li key={entry._id || `${entry.action || 'action'}-${entry.createdAt || index}`}>
                <strong>{entry.action || entry.event || 'Unknown action'}</strong>
                <p>User: {entry.user?.name || entry.user?.email || entry.actor?.name || '-'}</p>
                <p>Language: {entry.language || entry.context?.language || '-'}</p>
                <p>Target: {entry.target || entry.resourceId || '-'}</p>
                <p>At: {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'N/A'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Navbar>
  )
}

export default AuditLogs
