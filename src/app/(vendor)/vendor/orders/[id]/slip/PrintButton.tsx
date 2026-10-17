'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button className="slip-print-btn" onClick={() => window.print()}>
      <Printer size={16} aria-hidden /> Print or save as PDF
    </button>
  )
}   