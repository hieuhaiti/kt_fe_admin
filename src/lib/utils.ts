import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
const BASE_URL = import.meta.env.VITE_BASE_URL

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseLink(url: string) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  } else {
    if (url.startsWith('/')) {
      return `${BASE_URL}${url}`
    } else {
      return `${BASE_URL}/${url}`
    }
  }
}

export function isPdf(url: string): boolean {
  if (!url) return false
  return url.toLowerCase().endsWith('.pdf')
}
