import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateDDMMYYYY(dateInput?: string | Date | null): string {
  if (!dateInput) return "No expiry set"
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return "Invalid Date"
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}
