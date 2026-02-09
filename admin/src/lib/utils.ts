import { clsx, type ClassValue } from "clsx"
import { format } from "date-fns"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Display date as DD-MM-YYYY across the app. */
export function formatDisplayDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date + (date.includes("T") ? "" : "T12:00:00")) : date
  return format(d, "dd-MM-yyyy")
}
