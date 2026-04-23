import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function scoreTone(score) {
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-brand-700'
  if (score >= 40) return 'text-amber-600'
  return 'text-rose-600'
}
