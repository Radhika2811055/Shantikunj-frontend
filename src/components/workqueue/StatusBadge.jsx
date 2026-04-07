const pickTone = (value = '') => {
  const normalized = String(value).toLowerCase()

  if (normalized.includes('approved') || normalized.includes('published')) return 'success'
  if (normalized.includes('rejected') || normalized.includes('blocked') || normalized.includes('issues')) return 'danger'
  if (normalized.includes('in_progress') || normalized.includes('submitted') || normalized.includes('review')) return 'warning'
  return 'neutral'
}

const prettify = (value = '') => String(value).replaceAll('_', ' ')

const StatusBadge = ({ label, value }) => {
  const tone = pickTone(value)
  return (
    <span className={`status-badge ${tone}`}>
      <strong>{label}:</strong> {prettify(value || '-')}
    </span>
  )
}

export default StatusBadge
