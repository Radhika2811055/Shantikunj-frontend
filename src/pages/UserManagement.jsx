import { useEffect, useState } from 'react'
import api from '../api/axios'
import Navbar from '../components/Navbar'

const UserManagement = () => {
  const [pendingUsers, setPendingUsers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const [pendingRes, allRes] = await Promise.all([
        api.get('/admin/users/pending'),
        api.get('/admin/users/all')
      ])
      setPendingUsers(pendingRes.data || [])
      setAllUsers(allRes.data || [])
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to load users'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const approveUser = async (userId) => {
    setBusyKey(`approve-${userId}`)
    setMessage('')
    setError('')
    try {
      await api.put(`/admin/users/${userId}/approve`, {})
      await loadUsers()
      setMessage('User approved successfully')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to approve user'
      setError(msg)
    } finally {
      setBusyKey('')
    }
  }

  const rejectUser = async (userId) => {
    setBusyKey(`reject-${userId}`)
    setMessage('')
    setError('')
    try {
      await api.put(`/admin/users/${userId}/reject`)
      await loadUsers()
      setMessage('User rejected successfully')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to reject user'
      setError(msg)
    } finally {
      setBusyKey('')
    }
  }

  const deleteUser = async (userId, userName) => {
    const ok = window.confirm(`Delete ${userName}? This cannot be undone.`)
    if (!ok) return

    setBusyKey(`delete-${userId}`)
    setMessage('')
    setError('')
    try {
      await api.delete(`/admin/users/${userId}`)
      await loadUsers()
      setMessage('User deleted successfully')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to delete user'
      setError(msg)
    } finally {
      setBusyKey('')
    }
  }

  return (
    <Navbar>
      <section className="dashboard-head">
        <h2>User Management</h2>
        <p>Approve, reject, and manage onboarding users.</p>
        {message && <p style={{ color: '#0a7d2e' }}>{message}</p>}
        {error && <p style={{ color: '#b42318' }}>{error}</p>}
      </section>

      <section className="panel">
        <h3>Pending Users</h3>
        {loading ? (
          <p>Loading...</p>
        ) : pendingUsers.length === 0 ? (
          <p>No pending users.</p>
        ) : (
          <div className="task-grid two-col-grid">
            {pendingUsers.map((user) => {
              const isBusy = busyKey === `approve-${user._id}` || busyKey === `reject-${user._id}`
              return (
                <article className="task-card" key={user._id}>
                  <h4>{user.name}</h4>
                  <p>{user.email}</p>

                  <p>Requested role: {user.requestedRole || 'translator'}</p>
                  <p>Requested language: {user.requestedLanguage || 'English'}</p>

                  <div className="row-actions">
                    <button className="mini-btn" type="button" onClick={() => approveUser(user._id)} disabled={isBusy}>
                      Approve
                    </button>
                    <button className="mini-btn danger" type="button" onClick={() => rejectUser(user._id)} disabled={isBusy}>
                      Reject
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <h3>All Users ({allUsers.length})</h3>
        {allUsers.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <div className="activity-list">
            {allUsers.slice(0, 20).map((user) => (
              <li key={user._id}>
                <strong>{user.name} ({user.role})</strong>
                <p>{user.email} | {user.language || '-'} | {user.status}</p>
                {user.role !== 'admin' && (
                  <button
                    className="mini-btn danger"
                    type="button"
                    onClick={() => deleteUser(user._id, user.name)}
                    disabled={busyKey === `delete-${user._id}`}
                  >
                    {busyKey === `delete-${user._id}` ? 'Deleting...' : 'Delete User'}
                  </button>
                )}
              </li>
            ))}
          </div>
        )}
      </section>
    </Navbar>
  )
}

export default UserManagement
