import { format, formatDistanceToNow } from 'date-fns'

export function formatDate(timestamp) {
  return format(new Date(timestamp), 'MMM d, yyyy')
}

export function formatDateTime(timestamp) {
  return format(new Date(timestamp), 'MMM d, yyyy · h:mm a')
}

export function formatRelative(timestamp) {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
}

export function formatDuration(minutes) {
  if (!minutes) return '--'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

export function formatWeight(value, unit = 'kg') {
  if (value == null) return '--'
  return `${Number(value).toFixed(1)} ${unit}`
}

export function formatVolume(volume) {
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`
  }
  return volume.toFixed(0)
}
