import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

const BookManagement = () => {
  const { user } = useAuth()
  const [books, setBooks] = useState([])
  const [detailedBooks, setDetailedBooks] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bookForm, setBookForm] = useState({
    title: '',
    bookNumber: '',
    description: ''
  })
  const [bookActionLoading, setBookActionLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [booksRes, notifRes] = await Promise.all([
        api.get('/books'),
        api.get('/notifications/my').catch(() => ({ data: { notifications: [] } }))
      ])

      const booksList = Array.isArray(booksRes.data) ? booksRes.data : []
      setBooks(booksList)
      setNotifications(Array.isArray(notifRes.data.notifications) ? notifRes.data.notifications : [])

      const detailResponses = await Promise.all(
        booksList.map((book) => api.get(`/books/${book._id}`).catch(() => null))
      )

      setDetailedBooks(detailResponses.map((resp) => resp?.data).filter(Boolean))
    } catch (loadError) {
      setError(loadError?.response?.data?.message || 'Book management data could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sourceBooks = detailedBooks.length > 0 ? detailedBooks : books

  const publishableVersions = useMemo(() => {
    return sourceBooks
      .flatMap((book) =>
        (book.languageVersions || []).map((version) => ({
          bookId: book._id,
          versionId: version._id,
          title: book.title,
          language: version.language,
          stage: version.currentStage,
          audioStatus: version.audioStatus,
          feedbackDeadline: version.feedbackDeadline,
          isBlockedBySpoc: Boolean(version.isBlockedBySpoc)
        }))
      )
      .filter((item) => item.audioStatus === 'audio_approved' && item.stage !== 'published')
      .sort((a, b) => new Date(a.feedbackDeadline || 0).getTime() - new Date(b.feedbackDeadline || 0).getTime())
      .map((item) => {
        const canPublish = !item.isBlockedBySpoc

        return {
          ...item,
          canPublish
        }
      })
  }, [sourceBooks])

  const addBook = async () => {
    const title = bookForm.title.trim()
    const description = bookForm.description.trim()
    const bookNumber = Number(bookForm.bookNumber)

    if (!title || !Number.isFinite(bookNumber) || bookNumber <= 0) {
      setActionMessage('Please enter valid title and book number.')
      return
    }

    setBookActionLoading(true)
    setActionMessage('')
    try {
      const response = await api.post('/books', {
        title,
        bookNumber,
        description: description || null
      })

      const inviteSummary = response?.data?.inviteSummary

      setBookForm({ title: '', bookNumber: '', description: '' })

      if (inviteSummary) {
        const noRecipientCount = Array.isArray(inviteSummary.languagesWithoutRecipients)
          ? inviteSummary.languagesWithoutRecipients.length
          : 0
        const skippedByConfigCount = Array.isArray(inviteSummary.languagesSkippedByConfig)
          ? inviteSummary.languagesSkippedByConfig.length
          : 0
        const firstFailureReason = Array.isArray(inviteSummary.failedEmails) && inviteSummary.failedEmails.length > 0
          ? inviteSummary.failedEmails[0]?.reason || ''
          : ''

        const mailStatus = inviteSummary.totalEmailsAttempted > 0
          ? `${inviteSummary.totalEmailsSent}/${inviteSummary.totalEmailsAttempted} email(s) sent`
          : 'no translator emails to send yet'

        const missingLanguagesText = noRecipientCount > 0
          ? ` | No translator accounts for ${noRecipientCount} language(s).`
          : ''
        const skippedByConfigText = skippedByConfigCount > 0
          ? ` | ${skippedByConfigCount} language(s) skipped by initial invite config.`
          : ''
        const failureReasonText = inviteSummary.totalEmailsFailed > 0 && firstFailureReason
          ? ` | Mail failure sample: ${firstFailureReason}`
          : ''

        setActionMessage(
          `Book added successfully. Claim opened for ${inviteSummary.languagesOpenedForClaim || 0} language version(s); ${mailStatus}.${missingLanguagesText}${skippedByConfigText}${failureReasonText}`
        )
      } else {
        setActionMessage('Book added successfully. Translators can now claim it from Work Queue.')
      }

      await load()
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'Failed to add book.')
    } finally {
      setBookActionLoading(false)
    }
  }

  const publishVersion = async (item) => {
    setBookActionLoading(true)
    setActionMessage('')
    try {
      await api.put(`/books/${item.bookId}/versions/${item.versionId}/publish`)
      setActionMessage(`${item.title} (${item.language}) published successfully.`)
      await load()
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'Failed to publish version.')
    } finally {
      setBookActionLoading(false)
    }
  }

  if (user?.role !== 'admin') {
    return (
      <Navbar notifications={notifications.filter((item) => !item.isRead).length}>
        <section className="panel">
          <h3>Unauthorized</h3>
          <p>Only admin can access book management.</p>
        </section>
      </Navbar>
    )
  }

  return (
    <Navbar notifications={notifications.filter((item) => !item.isRead).length}>
      <section className="dashboard-head admin-head">
        <div>
          <h2>Book Management</h2>
          <p>Add new books and publish approved versions.</p>
        </div>
      </section>

      {error && (
        <section className="panel">
          <div className="alert-box danger">{error}</div>
        </section>
      )}

      {actionMessage && (
        <section className="panel">
          <div className="alert-box warning">{actionMessage}</div>
        </section>
      )}

      <section className="panel">
        <div className="task-grid two-col-grid">
          <article className="task-card">
            <h4>Add New Book</h4>
            <div className="form-row">
              <label>Book Title</label>
              <input
                value={bookForm.title}
                onChange={(event) => setBookForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Enter book title"
              />
            </div>
            <div className="form-row">
              <label>Book Number</label>
              <input
                type="number"
                min="1"
                value={bookForm.bookNumber}
                onChange={(event) => setBookForm((prev) => ({ ...prev, bookNumber: event.target.value }))}
                placeholder="e.g. 1"
              />
            </div>
            <div className="form-row">
              <label>Description (optional)</label>
              <input
                value={bookForm.description}
                onChange={(event) => setBookForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Short description"
              />
            </div>
            <button
              type="button"
              className="mini-btn"
              onClick={addBook}
              disabled={bookActionLoading}
            >
              {bookActionLoading ? 'Saving...' : 'Add Book'}
            </button>
          </article>

          <article className="task-card">
            <h4>Publish Ready Books</h4>
            {loading ? (
              <p>Loading...</p>
            ) : publishableVersions.length === 0 ? (
              <p>No SPOC-approved versions available for publish yet.</p>
            ) : (
              <ul className="activity-list">
                {publishableVersions.slice(0, 12).map((item) => (
                  <li key={`${item.bookId}-${item.versionId}`}>
                    <strong>{item.title} ({item.language})</strong>
                    <p>
                      Feedback deadline: {item.feedbackDeadline ? new Date(item.feedbackDeadline).toLocaleString() : 'Not set'}
                    </p>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="mini-btn"
                        disabled={!item.canPublish || bookActionLoading}
                        onClick={() => publishVersion(item)}
                      >
                        {bookActionLoading ? 'Publishing...' : 'Publish'}
                      </button>
                      {item.isBlockedBySpoc && <span>Blocked by SPOC</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </section>
    </Navbar>
  )
}

export default BookManagement
