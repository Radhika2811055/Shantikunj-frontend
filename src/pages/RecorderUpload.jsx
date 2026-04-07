import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getApiErrorMessage } from '../api/errorParser'
import { mapUploadResponseFiles } from '../api/uploadMapper'
import { booksService, notificationsService } from '../api/services'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { audioUploadRules, validateFiles } from '../utils/uploadValidation'

const RecorderUpload = () => {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const currentUserId = user?.id || user?._id || ''
  const preferredVersionId = searchParams.get('versionId') || ''

  const [assigned, setAssigned] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState({ type: '', text: '' })
  const [formState, setFormState] = useState({
    versionId: '',
    files: []
  })

  const isCurrentUser = useCallback((value) => {
    if (!value || !currentUserId) return false
    const normalized = value?._id || value
    return normalized?.toString() === currentUserId.toString()
  }, [currentUserId])

  const load = async () => {
    setLoading(true)
    try {
      const [assignedRes, notifRes] = await Promise.all([
        booksService.myAssignments().catch(() => ({ data: [] })),
        notificationsService.myNotifications().catch(() => ({ data: { notifications: [] } }))
      ])

      setAssigned(Array.isArray(assignedRes.data) ? assignedRes.data : [])
      setNotifications(Array.isArray(notifRes.data?.notifications) ? notifRes.data.notifications : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const uploadCandidates = useMemo(() => {
    const rows = []

    assigned.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        if (!isCurrentUser(version.assignedRecorder)) return
        if (!(version.currentStage === 'audio_generation' && version.audioStatus === 'audio_generated')) return

        rows.push({
          bookId: book._id,
          versionId: version._id,
          bookName: book.title,
          language: version.language
        })
      })
    })

    return rows
  }, [assigned, isCurrentUser])

  useEffect(() => {
    setFormState((prev) => {
      const hasPreferred = preferredVersionId && uploadCandidates.some((item) => item.versionId === preferredVersionId)
      if (hasPreferred && prev.versionId !== preferredVersionId) {
        return {
          versionId: preferredVersionId,
          files: []
        }
      }

      const exists = uploadCandidates.some((item) => item.versionId === prev.versionId)
      if (exists) return prev
      return {
        versionId: uploadCandidates[0]?.versionId || '',
        files: []
      }
    })
  }, [preferredVersionId, uploadCandidates])

  const selectedTask = useMemo(
    () => uploadCandidates.find((item) => item.versionId === formState.versionId) || null,
    [formState.versionId, uploadCandidates]
  )

  const onSubmit = async (event) => {
    event.preventDefault()

    if (!selectedTask) {
      setNotice({ type: 'error', text: 'No active audio assignment selected.' })
      return
    }

    if (!formState.files.length) {
      setNotice({ type: 'error', text: 'Please upload at least one MP3 or MP4 file.' })
      return
    }

    const fileValidation = validateFiles(formState.files, audioUploadRules, 'audio')
    if (!fileValidation.valid) {
      setNotice({ type: 'error', text: fileValidation.message })
      return
    }

    setUploading(true)
    setNotice({ type: '', text: '' })

    try {
      const payload = new FormData()
      formState.files.forEach((file) => {
        payload.append('audio', file)
      })

      const uploadRes = await booksService.uploadAudioFile(payload)
      const uploaded = mapUploadResponseFiles(uploadRes.data)
      const uniqueAudioUrls = [...new Set(uploaded.fileUrls)]
      const audioUrl = uniqueAudioUrls[0]

      if (!audioUrl) {
        throw new Error('Upload URL not returned by server')
      }

      await booksService.submitAudio(selectedTask.bookId, selectedTask.versionId, {
        audioUrl,
        audioUrls: uniqueAudioUrls,
        audioFiles: uploaded.files,
        audioFileMeta: uploaded.fileMeta
      })

      setNotice({
        type: 'success',
        text: `Uploaded and submitted ${uniqueAudioUrls.length} audio file${uniqueAudioUrls.length === 1 ? '' : 's'} successfully.`
      })
      setFormState((prev) => ({ ...prev, files: [] }))
      await load()
    } catch (error) {
      const message = getApiErrorMessage(error, 'Unable to upload and submit audio file')
      setNotice({ type: 'error', text: message })
    } finally {
      setUploading(false)
    }
  }

  const unreadCount = notifications.filter((item) => !item.isRead).length

  return (
    <Navbar notifications={unreadCount}>
      <section className="dashboard-head">
        <h2>Audio Upload</h2>
        <p>Upload your MP3 file for active recorder assignments.</p>
      </section>

      <section className="panel">
        <h3>Audio File Upload</h3>
        {loading ? (
          <p>Loading your upload form...</p>
        ) : uploadCandidates.length === 0 ? (
          <p>No active audio assignment found for upload.</p>
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
                <input value={user?.name || ''} readOnly />
              </div>
              <div className="form-row">
                <label>Email</label>
                <input value={user?.email || ''} readOnly />
              </div>
              <div className="form-row">
                <label>Role</label>
                <input value={user?.role || ''} readOnly />
              </div>
              <div className="form-row">
                <label>Language</label>
                <input value={selectedTask?.language || user?.language || ''} readOnly />
              </div>
            </div>

            <div className="form-row">
              <label>Select Book Assignment</label>
              <select
                value={formState.versionId}
                onChange={(event) => setFormState((prev) => ({ ...prev, versionId: event.target.value, files: [] }))}
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
                <label>Book ID</label>
                <input value={selectedTask?.bookId || ''} readOnly />
              </div>
            </div>

            <div className="form-row">
              <label>Upload MP3 / MP4 (multiple allowed)</label>
              <input
                type="file"
                accept=".mp3,.mp4,audio/mpeg,audio/mp4,video/mp4"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files || [])
                  setFormState((prev) => ({ ...prev, files }))
                }}
              />
            </div>

            {formState.files.length > 0 && (
              <p>
                Selected files: {formState.files.map((file) => file.name).join(', ')}
              </p>
            )}

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

export default RecorderUpload
