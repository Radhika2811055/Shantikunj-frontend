import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

const roleTitles = {
  admin: 'Platform Statistics',
  spoc: 'Language Statistics',
  translator: 'My Productivity',
  checker: 'Checker Statistics',
  recorder: 'Recorder Statistics',
  regional_team: 'Regional Feedback Statistics'
}

const roleSubtitles = {
  translator: 'Track your active assignments and delivery progress in one place.'
}

const stageLabels = {
  translation: 'Translation',
  checking: 'Text Vetting',
  spoc_review: 'SPOC Review',
  audio_generation: 'Audio Generation',
  audio_checking: 'Audio Vetting',
  final_verification: 'Final Verification',
  published: 'Published'
}

const platformPipelineStages = [
  { key: 'translation', label: 'Translation', accent: 'stage-translation' },
  { key: 'checking', label: 'Text Vetting', accent: 'stage-checking' },
  { key: 'spoc_review', label: 'SPOC Review', accent: 'stage-spoc-review' },
  { key: 'audio_generation', label: 'Audio Generation', accent: 'stage-audio-generation' },
  { key: 'audio_checking', label: 'Audio Vetting', accent: 'stage-audio-vetting' },
  { key: 'final_verification', label: 'Final Verification', accent: 'stage-final-verification' },
  { key: 'published', label: 'Published', accent: 'stage-published' }
]

const formatRelativeTime = (value) => {
  if (!value) return 'just now'
  const diffMs = Math.max(0, Date.now() - new Date(value).getTime())
  const mins = Math.floor(diffMs / (1000 * 60))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

const MiniLineChart = ({ title, labels, values, yMin, yMax, color, valueFormatter }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const width = 420
  const height = 230
  const padLeft = 46
  const padRight = 16
  const padTop = 18
  const padBottom = 38
  const innerW = width - padLeft - padRight
  const innerH = height - padTop - padBottom

  const safeMax = yMax > yMin ? yMax : yMin + 1
  const mapX = (index) => padLeft + ((innerW * index) / Math.max(1, labels.length - 1))
  const mapY = (value) => {
    const clamped = Math.min(safeMax, Math.max(yMin, value))
    const ratio = (clamped - yMin) / (safeMax - yMin)
    return padTop + innerH - ratio * innerH
  }

  const points = values.map((value, index) => ({ x: mapX(index), y: mapY(value), value }))
  const path = points.map((pt, index) => `${index === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')

  const yTicks = 4
  const tickValues = Array.from({ length: yTicks + 1 }, (_, idx) => {
    const raw = yMin + ((safeMax - yMin) * (yTicks - idx)) / yTicks
    return Math.round(raw * 10) / 10
  })

  return (
    <article className="trend-card">
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="mini-line-chart" role="img" aria-label={title}>
        {tickValues.map((tick, idx) => {
          const y = padTop + (innerH * idx) / yTicks
          return (
            <g key={`y-${tick}`}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} className="chart-grid-line" />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" className="chart-axis-label">{tick}</text>
            </g>
          )
        })}

        <line x1={padLeft} y1={padTop} x2={padLeft} y2={height - padBottom} className="chart-axis-line" />
        <line x1={padLeft} y1={height - padBottom} x2={width - padRight} y2={height - padBottom} className="chart-axis-line" />

        {labels.map((label, idx) => (
          <text
            key={`x-${label}-${idx}`}
            x={mapX(idx)}
            y={height - 10}
            textAnchor="middle"
            className="chart-axis-label"
          >
            {label}
          </text>
        ))}

        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />

        {points.map((pt, idx) => (
          <g key={`pt-${idx}`}>
            <circle cx={pt.x} cy={pt.y} r="4.6" fill={color} />
            <circle
              cx={pt.x}
              cy={pt.y}
              r="10"
              fill="transparent"
              className="chart-hit-dot"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(idx)}
              onBlur={() => setHoveredIndex(null)}
              tabIndex={0}
            />
          </g>
        ))}
      </svg>

      {hoveredIndex !== null && points[hoveredIndex] && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(points[hoveredIndex].x / width) * 100}%`,
            top: `${(points[hoveredIndex].y / height) * 100}%`
          }}
        >
          {`${labels[hoveredIndex]}: ${valueFormatter ? valueFormatter(points[hoveredIndex].value) : points[hoveredIndex].value}`}
        </div>
      )}
    </article>
  )
}

const Statistics = () => {
  const { user } = useAuth()
  const [books, setBooks] = useState([])
  const [detailedBooks, setDetailedBooks] = useState([])
  const [assigned, setAssigned] = useState([])
  const [translatorClaims, setTranslatorClaims] = useState([])
  const [usersCount, setUsersCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStatsLanguage, setSelectedStatsLanguage] = useState('all')

  const isCurrentUser = useCallback((value) => {
    if (!value || !user?.id) return false
    return value === user.id || value?._id === user.id
  }, [user?.id])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [booksRes, assignedRes, notifRes, claimsRes] = await Promise.all([
          api.get('/books').catch(() => ({ data: [] })),
          api.get('/books/my-assignments').catch(() => ({ data: [] })),
          api.get('/notifications/my').catch(() => ({ data: { notifications: [] } })),
          user?.role === 'translator'
            ? api.get('/claims/my-history', { params: { claimType: 'translation', limit: 180 } }).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] })
        ])

        const baseBooks = Array.isArray(booksRes.data) ? booksRes.data : []
        setBooks(baseBooks)
        setAssigned(Array.isArray(assignedRes.data) ? assignedRes.data : [])
        setTranslatorClaims(Array.isArray(claimsRes.data) ? claimsRes.data : [])
        setNotifications(Array.isArray(notifRes.data?.notifications) ? notifRes.data.notifications : [])

        const detailResponses = await Promise.all(
          baseBooks.map((book) => api.get(`/books/${book._id}`).catch(() => null))
        )
        setDetailedBooks(detailResponses.map((resp) => resp?.data).filter(Boolean))

        if (user?.role === 'admin') {
          const usersRes = await api.get('/admin/users/all').catch(() => ({ data: [] }))
          setUsersCount(Array.isArray(usersRes.data) ? usersRes.data.length : 0)
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.role])

  const versions = useMemo(() => {
    const sourceBooks = detailedBooks.length > 0 ? detailedBooks : books
    const allVersions = []

    sourceBooks.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        if (user?.role === 'spoc' && version.language !== user?.language) return

        allVersions.push({
          ...version,
          bookId: book._id,
          bookTitle: book.title
        })
      })
    })

    if (user?.role === 'admin' && selectedStatsLanguage !== 'all') {
      return allVersions.filter((item) => item.language === selectedStatsLanguage)
    }

    return allVersions
  }, [books, detailedBooks, user?.role, user?.language, selectedStatsLanguage])

  const adminStatsLanguageOptions = useMemo(() => {
    if (user?.role !== 'admin') return []

    const sourceBooks = detailedBooks.length > 0 ? detailedBooks : books
    const activeLanguages = new Set()
    const fallbackLanguages = new Set()

    sourceBooks.forEach((book) => {
      ;(book.languageVersions || []).forEach((version) => {
        const language = String(version.language || '').trim()
        if (!language) return

        fallbackLanguages.add(language)

        const hasAssignment = Boolean(
          version.assignedTranslator ||
          version.assignedChecker ||
          version.assignedRecorder ||
          version.assignedAudioChecker
        )
        const hasProgress =
          version.currentStage !== 'translation' ||
          version.textStatus !== 'not_started' ||
          version.audioStatus !== 'not_started'
        const hasFeedback = Boolean(String(version.feedback || '').trim())

        if (hasAssignment || hasProgress || hasFeedback) {
          activeLanguages.add(language)
        }
      })
    })

    const options = activeLanguages.size > 0 ? [...activeLanguages] : [...fallbackLanguages]
    return options.sort((a, b) => a.localeCompare(b))
  }, [books, detailedBooks, user?.role])

  useEffect(() => {
    if (user?.role !== 'admin') return

    setSelectedStatsLanguage((prev) => {
      if (prev === 'all') return 'all'
      if (adminStatsLanguageOptions.includes(prev)) return prev
      return 'all'
    })
  }, [adminStatsLanguageOptions, user?.role])

  const statCards = useMemo(() => {
    const scopedBooks = user?.role === 'admin'
      ? new Set(versions.map((version) => String(version.bookId || ''))).size
      : books.length
    const published = versions.filter((version) => version.currentStage === 'published' || version.audioStatus === 'published').length
    const blockers = versions.filter((version) => version.isBlockedBySpoc).length

    let spocReviewReadyCount = 0

    if (user?.role === 'spoc') {
      const isSpocReviewReady = (version) => {
        if (!version || version.currentStage !== 'spoc_review') return false
        if (version.textStatus === 'checking_submitted') return true

        // Backward compatibility for older records moved to SPOC stage without status normalization.
        if (version.textStatus !== 'checking_in_progress') return false

        const hasPrimaryText = Boolean(String(version.textFileUrl || '').trim())
        const hasMultiText = Array.isArray(version.textFileUrls)
          && version.textFileUrls.some((item) => Boolean(String(item || '').trim()))

        return hasPrimaryText || hasMultiText
      }

      spocReviewReadyCount = versions.filter((version) => isSpocReviewReady(version)).length
    }

    const cards = [
      { label: 'Books', value: scopedBooks },
      { label: 'Published Versions', value: published },
      {
        label: user?.role === 'admin' ? 'Total Users' : 'My Assignments',
        value: user?.role === 'admin'
          ? usersCount
          : (user?.role === 'spoc' ? spocReviewReadyCount : assigned.length)
      },
      { label: 'Active Blockers', value: blockers }
    ]

    if (user?.role === 'spoc') {
      cards.splice(2, 0, {
        label: 'Pending Reviews',
        value: spocReviewReadyCount
      })
    }

    return cards
  }, [versions, books.length, user?.role, usersCount, assigned.length])

  const stageBreakdown = useMemo(() => {
    const counts = {}
    const stageOrder = platformPipelineStages.map((stage) => stage.key)

    versions.forEach((version) => {
      const key = version.currentStage || 'translation'
      counts[key] = (counts[key] || 0) + 1
    })

    const extraStages = Object.keys(counts)
      .filter((stage) => !stageOrder.includes(stage))
      .sort((a, b) => a.localeCompare(b))

    const orderedStages = [...stageOrder, ...extraStages]

    const rows = orderedStages
      .map((stage) => {
        const count = counts[stage] || 0
        return {
          stage,
          count,
          label: stageLabels[stage] || stage.replaceAll('_', ' '),
          fillClass: `stage-${stage.replaceAll('_', '-')}`
        }
      })
      .filter((row) => row.count > 0)

    const total = rows.reduce((sum, row) => sum + row.count, 0)
    const bottleneck = rows.reduce((maxRow, row) => {
      if (!maxRow) return row
      return row.count > maxRow.count ? row : maxRow
    }, null)

    const maxCount = Math.max(...rows.map((row) => row.count), 1)

    return {
      total,
      bottleneck,
      rows: rows.map((row) => ({
        ...row,
        percentage: total > 0 ? Math.round((row.count / total) * 100) : 0,
        width: `${Math.max(8, Math.round((row.count / maxCount) * 100))}%`
      }))
    }
  }, [versions])

  const translatorAssignedVersions = useMemo(() => {
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
          updatedAt: version.updatedAt
        })
      })
    })

    return rows.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
  }, [assigned, isCurrentUser, user?.role])

  const translatorCards = useMemo(() => {
    if (user?.role !== 'translator') return []

    const translated = translatorClaims.filter((claim) => claim.claimType === 'translation' && ['submitted', 'completed'].includes(claim.status)).length
    const current = Math.min(
      1,
      translatorAssignedVersions.filter((item) => item.currentStage === 'translation' && item.textStatus === 'translation_in_progress').length
    )

    return [
      { label: 'Books Translated', value: translated },
      { label: 'Currently Translating', value: current }
    ]
  }, [translatorClaims, translatorAssignedVersions, user?.role])

  const translatorMonthlySeries = useMemo(() => {
    if (user?.role !== 'translator') return { labels: [], values: [] }

    const now = new Date()
    const keys = Array.from({ length: 6 }, (_, idx) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    })

    const labels = keys.map((key) => {
      const [year, month] = key.split('-').map(Number)
      return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' })
    })

    const countsByMonth = Object.fromEntries(keys.map((key) => [key, 0]))

    translatorClaims.forEach((claim) => {
      if (claim.claimType !== 'translation') return
      if (!['submitted', 'completed'].includes(claim.status)) return

      const eventDate = claim.updatedAt || claim.createdAt || claim.claimedAt
      if (!eventDate) return

      const date = new Date(eventDate)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!Object.prototype.hasOwnProperty.call(countsByMonth, key)) return
      countsByMonth[key] += 1
    })

    return {
      labels,
      values: keys.map((key) => countsByMonth[key])
    }
  }, [translatorClaims, user?.role])

  const headline = roleTitles[user?.role] || 'Statistics'
  const subtitle = roleSubtitles[user?.role] || 'Role-based progress and bottleneck visibility in one place.'

  const spocTrendSeries = useMemo(() => {
    if (user?.role !== 'spoc') {
      return {
        labels: [],
        booksCompleted: []
      }
    }

    const now = new Date()
    const keys = Array.from({ length: 6 }, (_, idx) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    })

    const labels = keys.map((key) => {
      const [year, month] = key.split('-').map(Number)
      return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' })
    })

    const completedByMonth = Object.fromEntries(keys.map((key) => [key, 0]))

    versions.forEach((item) => {
      if (!item.updatedAt) return
      const date = new Date(item.updatedAt)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!Object.prototype.hasOwnProperty.call(completedByMonth, key)) return

      if (item.currentStage === 'published' || item.audioStatus === 'published') {
        completedByMonth[key] += 1
      }
    })

    const booksCompleted = keys.map((key) => completedByMonth[key])

    return { labels, booksCompleted }
  }, [versions, user?.role])

  const adminBooksByStage = useMemo(() => {
    if (user?.role !== 'admin') return []

    return platformPipelineStages.map((stage) => {
      const stageItems = versions
        .filter((item) => item.currentStage === stage.key)
        .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      const items = stageItems.slice(0, 3)

      return {
        ...stage,
        count: stageItems.length,
        items
      }
    })
  }, [versions, user?.role])

  const adminActiveBooksTotal = useMemo(() => {
    if (user?.role !== 'admin') return 0
    return adminBooksByStage.reduce((sum, bucket) => sum + bucket.count, 0)
  }, [adminBooksByStage, user?.role])

  const adminBottleneckStage = useMemo(() => {
    if (user?.role !== 'admin' || adminBooksByStage.length === 0) return null
    return adminBooksByStage.reduce((maxBucket, bucket) => {
      if (!maxBucket) return bucket
      return bucket.count > maxBucket.count ? bucket : maxBucket
    }, null)
  }, [adminBooksByStage, user?.role])

  return (
    <Navbar notifications={notifications.filter((item) => !item.isRead).length}>
      <section className="dashboard-head">
        <h2>{headline}</h2>
        <p>{subtitle}</p>
      </section>

      {loading ? (
        <section className="panel">
          <h3>Loading statistics...</h3>
        </section>
      ) : (
        <>
          {user?.role === 'admin' && (
            <section className="panel admin-language-report-panel">
              <div className="admin-language-filter-row">
                <div>
                  <h3>Language-wise Analytics</h3>
                  <p>Filter platform analytics by selected language.</p>
                </div>
                <label className="admin-language-filter" htmlFor="stats-language-filter">
                  <span>Language</span>
                  <select
                    id="stats-language-filter"
                    value={selectedStatsLanguage}
                    onChange={(event) => setSelectedStatsLanguage(event.target.value)}
                  >
                    <option value="all">All Languages</option>
                    {adminStatsLanguageOptions.map((language) => (
                      <option key={language} value={language}>{language}</option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          )}

          {user?.role !== 'translator' && (
            <section className="stat-grid stats-grid-wide">
              {statCards.map((card) => (
                <article className="stat-card" key={card.label}>
                  <h3>{card.label}</h3>
                  <strong>{card.value}</strong>
                </article>
              ))}
            </section>
          )}

          {user?.role === 'spoc' && (
            <section className="trend-grid">
              <MiniLineChart
                title="Books Completed"
                labels={spocTrendSeries.labels}
                values={spocTrendSeries.booksCompleted}
                yMin={0}
                yMax={Math.max(10, ...spocTrendSeries.booksCompleted, 10)}
                color="#3d7fe0"
                valueFormatter={(value) => `${value} books completed`}
              />
            </section>
          )}

          {user?.role === 'translator' && (
            <>
              <section className="stat-grid translator-metric-grid">
                {translatorCards.map((card) => (
                  <article className="stat-card" key={card.label}>
                    <h3>{card.label}</h3>
                    <strong>{card.value}</strong>
                  </article>
                ))}
              </section>

              <section className="trend-grid">
                <MiniLineChart
                  title="Monthly Translation Output"
                  labels={translatorMonthlySeries.labels}
                  values={translatorMonthlySeries.values}
                  yMin={0}
                  yMax={Math.max(4, ...translatorMonthlySeries.values, 4)}
                  color="#1f7ac8"
                  valueFormatter={(value) => `${value} translations`}
                />
              </section>
            </>
          )}

          {user?.role !== 'spoc' && user?.role !== 'translator' && (
            <section className="panel">
              <div className="stats-section-head">
                <div>
                  <h3>Stage Distribution</h3>
                  <p className="analytics-note">
                    {stageBreakdown.total} active version{stageBreakdown.total === 1 ? '' : 's'} in the selected scope.
                  </p>
                </div>
                {stageBreakdown.bottleneck && (
                  <span className="member-stat-chip is-overdue">
                    Bottleneck: {stageBreakdown.bottleneck.label}
                  </span>
                )}
              </div>

              {stageBreakdown.rows.length === 0 ? (
                <p>No workflow records found yet.</p>
              ) : (
                <div className="stats-bars">
                  {stageBreakdown.rows.map((row) => (
                    <div className="stats-bar-row" key={row.stage}>
                      <div className="stats-bar-top">
                        <p>{row.label}</p>
                        <div className="stats-bar-metrics">
                          <span>{row.percentage}%</span>
                          <strong>{row.count}</strong>
                        </div>
                      </div>
                      <div className="stats-bar-track">
                        <div className={`stats-bar-fill ${row.fillClass}`} style={{ width: row.width }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {user?.role === 'admin' && (
            <section className="panel">
              <div className="stats-section-head">
                <div>
                  <h3>Active Books</h3>
                  <p className="analytics-note">Showing top 3 recent books per stage in current language scope.</p>
                </div>
                <div className="row-actions">
                  <span className="member-stat-chip is-clear">Total Active: {adminActiveBooksTotal}</span>
                  {adminBottleneckStage && (
                    <span className="member-stat-chip is-overdue">Highest Load: {adminBottleneckStage.label}</span>
                  )}
                </div>
              </div>

              <div className="admin-stage-columns stats-stage-columns">
                {adminBooksByStage.map((bucket) => (
                  <div className="admin-stage-column" key={bucket.key}>
                    <div className="admin-stage-title">
                      <p>{bucket.label}</p>
                      <div className="admin-stage-metrics">
                        <span>{bucket.count}</span>
                        <span className="admin-stage-share">
                          {adminActiveBooksTotal > 0 ? `${Math.round((bucket.count / adminActiveBooksTotal) * 100)}%` : '0%'}
                        </span>
                      </div>
                    </div>
                    {bucket.items.length > 0 ? (
                      bucket.items.map((item, idx) => (
                        <article className={`admin-book-card ${bucket.accent}`} key={`${bucket.key}-${item.bookTitle}-${item.language}-${idx}`}>
                          <h4>{item.bookTitle}</h4>
                          <p>{item.language} • {formatRelativeTime(item.updatedAt)}</p>
                        </article>
                      ))
                    ) : (
                      <p className="admin-empty-note">No active books</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

        </>
      )}
    </Navbar>
  )
}

export default Statistics
