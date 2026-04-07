import { useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import StatusBadge from '../components/workqueue/StatusBadge'
import { useAuth } from '../context/AuthContext'

const normalizeId = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    if (value._id || value.id) return value._id || value.id
    if (typeof value.toString === 'function') {
      const candidate = value.toString()
      if (candidate && candidate !== '[object Object]') return candidate
    }
  }
  return ''
}

const formatDateTime = (value) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

const isReassignedItem = (item) => {
  const attempts = Number(item?.attempts || 0)
  const revisionSentCount = Number(item?.revisionSentCount || 0)
  return attempts > 1 || revisionSentCount > 0
}

const CheckerHistory = () => {
  const { user } = useAuth()
  const currentUserId = user?.id || user?._id || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notifications, setNotifications] = useState([])
  const [claims, setClaims] = useState([])
  const [assignedBooks, setAssignedBooks] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const [historyRes, assignedRes, notifRes] = await Promise.all([
          api.get('/claims/my-history?claimType=checking&limit=300').catch(() => ({ data: [] })),
          api.get('/books/my-assignments').catch(() => ({ data: [] })),
          api.get('/notifications/my').catch(() => ({ data: { notifications: [] } }))
        ])

        if (cancelled) return

        setClaims(Array.isArray(historyRes.data) ? historyRes.data : [])
        setAssignedBooks(Array.isArray(assignedRes.data) ? assignedRes.data : [])
        setNotifications(Array.isArray(notifRes.data?.notifications) ? notifRes.data.notifications : [])
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.response?.data?.message || 'Failed to load checker work history.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const workedBooks = useMemo(() => {
    const grouped = new Map()

    claims.forEach((claim) => {
      if (claim?.claimType !== 'checking') return

      const bookId = normalizeId(claim.book)
      const language = String(claim.language || '').trim()
      const key = `${bookId || 'unknown'}:${language || 'unknown'}`

      const claimTimestamp = new Date(claim.updatedAt || claim.claimedAt || 0).getTime()
      const safeClaimTimestamp = Number.isNaN(claimTimestamp) ? 0 : claimTimestamp
      const existing = grouped.get(key)

      if (!existing) {
        grouped.set(key, {
          key,
          bookId,
          title: claim.book?.title || 'Untitled book',
          bookNumber: claim.book?.bookNumber || '-',
          language: language || user?.language || '-',
          attempts: 1,
          revisionSentCount: 0,
          firstClaimedAt: claim.claimedAt || claim.createdAt || null,
          lastWorkedAt: claim.updatedAt || claim.claimedAt || null,
          latestClaimStatus: claim.status || 'active',
          latestDeadline: claim.deadline || null,
          currentlyAssigned: false,
          currentTextStatus: '',
          currentStage: ''
        })
        return
      }

      existing.attempts += 1

      const existingTimestamp = new Date(existing.lastWorkedAt || 0).getTime()
      const safeExistingTimestamp = Number.isNaN(existingTimestamp) ? 0 : existingTimestamp
      if (safeClaimTimestamp >= safeExistingTimestamp) {
        existing.lastWorkedAt = claim.updatedAt || claim.claimedAt || existing.lastWorkedAt
        existing.latestClaimStatus = claim.status || existing.latestClaimStatus
        existing.latestDeadline = claim.deadline || existing.latestDeadline
        if (claim.book?.title) existing.title = claim.book.title
        if (claim.book?.bookNumber) existing.bookNumber = claim.book.bookNumber
      }

      const firstClaimed = new Date(existing.firstClaimedAt || 0).getTime()
      const incomingFirst = new Date(claim.claimedAt || claim.createdAt || 0).getTime()
      if (!Number.isNaN(incomingFirst) && (Number.isNaN(firstClaimed) || incomingFirst < firstClaimed)) {
        existing.firstClaimedAt = claim.claimedAt || claim.createdAt || existing.firstClaimedAt
      }
    })

    assignedBooks.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        const checkerId = normalizeId(version.assignedChecker)
        if (!checkerId || checkerId.toString() !== currentUserId.toString()) return

        if (version.currentStage !== 'checking') return
        if (!['translation_submitted', 'checking_in_progress'].includes(version.textStatus)) return

        const bookId = normalizeId(book._id)
        const language = String(version.language || '').trim()
        const key = `${bookId || 'unknown'}:${language || 'unknown'}`
        const existing = grouped.get(key)

        if (!existing) {
          grouped.set(key, {
            key,
            bookId,
            title: book.title || 'Untitled book',
            bookNumber: book.bookNumber || '-',
            language: language || user?.language || '-',
            attempts: 0,
            revisionSentCount: Number(version.textRejectionCount || 0),
            firstClaimedAt: version.createdAt || book.createdAt || null,
            lastWorkedAt: version.updatedAt || book.updatedAt || null,
            latestClaimStatus: 'active',
            latestDeadline: version.checkerDeadline || null,
            currentlyAssigned: true,
            currentTextStatus: version.textStatus || '',
            currentStage: version.currentStage || ''
          })
          return
        }

        existing.currentlyAssigned = true
        existing.currentTextStatus = version.textStatus || existing.currentTextStatus
        existing.currentStage = version.currentStage || existing.currentStage
        existing.latestDeadline = version.checkerDeadline || existing.latestDeadline
        existing.revisionSentCount = Math.max(
          Number(existing.revisionSentCount || 0),
          Number(version.textRejectionCount || 0)
        )
      })
    })

    return Array.from(grouped.values()).sort((a, b) => {
      const aTime = new Date(a.lastWorkedAt || 0).getTime()
      const bTime = new Date(b.lastWorkedAt || 0).getTime()
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime)
    })
  }, [assignedBooks, claims, currentUserId, user?.language])

  const visibleBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return workedBooks.filter((item) => {
      if (statusFilter === 'active' && !item.currentlyAssigned) return false
      if (statusFilter === 'submitted' && !['submitted', 'completed'].includes(item.latestClaimStatus)) return false
      if (statusFilter === 'reassigned' && !isReassignedItem(item)) return false

      if (!query) return true
      const haystack = `${item.title} ${item.bookNumber} ${item.language}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [searchQuery, statusFilter, workedBooks])

  const summary = useMemo(() => {
    const submittedClaims = claims.filter(
      (item) => item?.claimType === 'checking' && ['submitted', 'completed'].includes(item.status)
    ).length

    return {
      workedBooks: workedBooks.length,
      totalClaims: claims.filter((item) => item?.claimType === 'checking').length,
      activeBooks: workedBooks.filter((item) => item.currentlyAssigned).length,
      submittedClaims
    }
  }, [claims, workedBooks])

  return (
    <Navbar notifications={notifications.filter((item) => !item.isRead).length}>
      <section className="dashboard-head checker-page-head">
        <h2>Checker Work History</h2>
        <p>Track every book-language version you vetted, including current tasks and historical submissions.</p>
      </section>

      <section className="panel checker-claims-panel">
        <div className="checker-kpi-grid">
          <article className="checker-kpi-card">
            <span>Books Worked</span>
            <strong>{summary.workedBooks}</strong>
          </article>
          <article className="checker-kpi-card">
            <span>Total Claims</span>
            <strong>{summary.totalClaims}</strong>
          </article>
          <article className="checker-kpi-card">
            <span>Approved Claims</span>
            <strong>{summary.submittedClaims}</strong>
          </article>
          <article className="checker-kpi-card">
            <span>Currently Active</span>
            <strong>{summary.activeBooks}</strong>
          </article>
        </div>
      </section>

      <section className="panel checker-claims-panel">
        <div className="checker-section-head">
          <h3>Worked Books</h3>
          <span>{visibleBooks.length} shown</span>
          <div className="checker-task-filters">
            {[
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'submitted', label: 'Approved' },
              { key: 'reassigned', label: 'Re-sent' }
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`checker-filter-chip ${statusFilter === filter.key ? 'active' : ''}`}
                onClick={() => setStatusFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row spoc-review-search">
          <label>Search by title, book number, or language</label>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search worked books"
          />
        </div>

        {error ? <p className="checker-inline-message">{error}</p> : null}

        {loading ? (
          <p>Loading checker history...</p>
        ) : visibleBooks.length === 0 ? (
          <p className="checker-empty-state">No worked books found for this filter yet.</p>
        ) : (
          <div className="task-grid checker-vetting-grid">
            {visibleBooks.map((item) => (
              <article className="task-card checker-vetting-card" key={item.key}>
                <div className="checker-vetting-head">
                  <h4>
                    {item.title}
                    {item.bookNumber ? ` - Book ${item.bookNumber}` : ''}
                  </h4>
                  <span className={`checker-state-chip ${item.currentlyAssigned ? 'active' : 'revision'}`}>
                    {item.currentlyAssigned ? 'Active now' : 'History'}
                  </span>
                </div>

                <p className="checker-language-line">Language: {item.language}</p>
                <p className="checker-meta-line">First claimed: {formatDateTime(item.firstClaimedAt)}</p>
                <p className="checker-meta-line">Last activity: {formatDateTime(item.lastWorkedAt)}</p>
                <p className="checker-meta-line">Attempts: {item.attempts}</p>

                <div className="audio-review-status-row">
                  <StatusBadge label="Claim" value={item.latestClaimStatus || '-'} />
                  {item.currentTextStatus ? <StatusBadge label="Text" value={item.currentTextStatus} /> : null}
                  {item.currentStage ? <StatusBadge label="Stage" value={item.currentStage} /> : null}
                </div>

                {item.latestDeadline ? (
                  <p className="checker-meta-line">Latest deadline: {formatDateTime(item.latestDeadline)}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </Navbar>
  )
}

export default CheckerHistory