import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

const TranslatorUpload = () => {
  const { user } = useAuth()
  const currentUserId = user?.id || user?._id || ''
  const [profile, setProfile] = useState(null)
  const [assigned, setAssigned] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState({ type: '', text: '' })
  const [fileInputKey, setFileInputKey] = useState(0)
  const [formState, setFormState] = useState({
    versionId: '',
    files: []
  })

  const isCurrentUser = useCallback((value) => {
    if (!value || !currentUserId) return false

    const normalized = value?._id || value
    return normalized?.toString() === currentUserId.toString()
  }, [currentUserId])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [assignedRes, notifRes, profileRes] = await Promise.all([
          api.get('/books/my-assignments').catch(() => ({ data: [] })),
          api.get('/notifications/my').catch(() => ({ data: { notifications: [] } })),
          api.get('/auth/me').catch(() => ({ data: null }))
        ])

        setAssigned(Array.isArray(assignedRes.data) ? assignedRes.data : [])
        setNotifications(Array.isArray(notifRes.data?.notifications) ? notifRes.data.notifications : [])
        setProfile(profileRes.data || null)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const uploadCandidates = useMemo(() => {
    const rows = []

    assigned.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        if (!isCurrentUser(version.assignedTranslator)) return
        if (!(version.currentStage === 'translation' && version.textStatus === 'translation_in_progress')) return

        rows.push({
          bookId: book._id,
          bookNumber: book.bookNumber,
          versionId: version._id,
          bookName: book.title,
          language: version.language,
          stage: version.currentStage,
          previousSubmissions: [
            ...(Array.isArray(version.textFileUrls) ? version.textFileUrls : []),
            ...(version.textFileUrl ? [version.textFileUrl] : [])
          ].filter(Boolean)
        })
      })
    })

    return rows
  }, [assigned, isCurrentUser])

  useEffect(() => {
    setFormState((prev) => {
      const exists = uploadCandidates.some((item) => item.versionId === prev.versionId)
      if (exists) return prev
      return {
        versionId: uploadCandidates[0]?.versionId || '',
        files: []
      }
    })
  }, [uploadCandidates])

  const selectedTask = useMemo(
    () => uploadCandidates.find((item) => item.versionId === formState.versionId) || null,
    [formState.versionId, uploadCandidates]
  )

  const prefilledName = profile?.name || user?.name || ''
  const prefilledEmail = profile?.email || user?.email || ''
  const prefilledRole = profile?.role || user?.role || ''
  const prefilledLanguage = profile?.language || selectedTask?.language || user?.language || ''

  const onSubmit = async (event) => {
    event.preventDefault()

    if (!selectedTask) {
      setNotice({ type: 'error', text: 'No active translation assignment selected.' })
      return
    }

    if (!Array.isArray(formState.files) || formState.files.length === 0) {
      setNotice({ type: 'error', text: 'Please upload at least one translated document.' })
      return
    }

    setUploading(true)
    setNotice({ type: '', text: '' })

    try {
      const payload = new FormData()
      formState.files.forEach((file) => {
        payload.append('documents', file)
      })

      const uploadRes = await api.post('/books/upload-translation-doc', payload)
      const uploadedFiles = Array.isArray(uploadRes.data?.files) && uploadRes.data.files.length > 0
        ? uploadRes.data.files
        : (uploadRes.data?.fileUrl ? [{ fileUrl: uploadRes.data.fileUrl }] : [])

      const textFileUrls = uploadedFiles
        .map((item) => (typeof item?.fileUrl === 'string' ? item.fileUrl.trim() : ''))
        .filter(Boolean)

      if (textFileUrls.length === 0) {
        throw new Error('Upload URL not returned by server')
      }

      await api.post(`/books/${selectedTask.bookId}/versions/${selectedTask.versionId}/submit-translation`, {
        textFileUrl: textFileUrls[0],
        textFileUrls
      })

      setNotice({
        type: 'success',
        text: `${textFileUrls.length} file(s) uploaded and translation submitted successfully.`
      })
      setFormState((prev) => ({ ...prev, files: [] }))
      setFileInputKey((prev) => prev + 1)
    } catch (error) {
      const rawResponseText = typeof error?.response?.data === 'string'
        ? error.response.data.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : ''
      const responseMessage = error?.response?.data?.message || (rawResponseText ? rawResponseText.slice(0, 220) : '')
      const msg = responseMessage || error?.message || 'Unable to upload and submit file'
      setNotice({ type: 'error', text: msg })
    } finally {
      setUploading(false)
    }
  }

  const unreadCount = notifications.filter((item) => !item.isRead).length

  return (
    <Navbar notifications={unreadCount}>
      <section className="dashboard-head">
        <h2>Translation File Upload</h2>
        <p>Your profile and assignment details are prefilled. Just upload the document.</p>
      </section>

      <section className="panel">
        {loading ? (
          <p>Loading your upload form...</p>
        ) : uploadCandidates.length === 0 ? (
          <p>No active translation assignment found for upload.</p>
        ) : (
          <form className="translator-upload-form" onSubmit={onSubmit}>
            {notice.text && (
              <div className={notice.type === 'success' ? 'ok-box' : 'error-box'}>
                {notice.text}
              </div>
            )}

            <div className="translator-upload-grid">
              <div className="form-row">
                <label>User Name</label>
                <input value={prefilledName} readOnly />
              </div>
              <div className="form-row">
                <label>Email</label>
                <input value={prefilledEmail} readOnly />
              </div>
              <div className="form-row">
                <label>Role</label>
                <input value={prefilledRole} readOnly />
              </div>
              <div className="form-row">
                <label>Language</label>
                <input value={prefilledLanguage} readOnly />
              </div>
            </div>

            <div className="form-row">
              <label>Select Book Assignment</label>
              <select
                value={formState.versionId}
                onChange={(event) => setFormState((prev) => ({ ...prev, versionId: event.target.value }))}
              >
                {uploadCandidates.map((item) => (
                  <option key={item.versionId} value={item.versionId}>
                    {item.bookName} ({item.language})
                  </option>
                ))}
              </select>
            </div>

            <div className="translator-upload-grid">
              <div className="form-row">
                <label>Book Name</label>
                <input value={selectedTask?.bookName || ''} readOnly />
              </div>
              <div className="form-row">
                <label>Book Number</label>
                <input value={selectedTask?.bookNumber || ''} readOnly />
              </div>
            </div>

            <div className="form-row">
              <label>Upload PDF / DOC / DOCX / TXT (multiple allowed)</label>
              <input
                key={fileInputKey}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(event) => {
                  const files = Array.from(event.target.files || [])
                  setFormState((prev) => ({ ...prev, files }))
                }}
              />
            </div>

            {formState.files.length > 0 ? (
              <p>{formState.files.length} file(s) selected for upload.</p>
            ) : null}

            {Array.isArray(selectedTask?.previousSubmissions) && selectedTask.previousSubmissions.length > 0 ? (
              <div>
                <p>Previous Submissions:</p>
                <ul className="activity-list">
                  {selectedTask.previousSubmissions.map((url, index) => (
                    <li key={`${url}-${index}`}>
                      <a href={url} target="_blank" rel="noreferrer">Open file {index + 1}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              className="mini-btn"
              type="submit"
              disabled={uploading || !selectedTask || formState.files.length === 0}
            >
              {uploading ? 'Uploading and submitting...' : 'Upload and Submit'}
            </button>
          </form>
        )}
      </section>
    </Navbar>
  )
}

export default TranslatorUpload
