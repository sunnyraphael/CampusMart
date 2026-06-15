"use client"

import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { CheckCircle2 } from "lucide-react"

const whyCampusMart = [
  'Student verified sellers',
  'Meet on campus or local pickup',
  'Safe & secure transactions',
  'Support your campus community',
]

export default function JoinCard() {
  const { user } = useAuth()

  return (
    <aside className="hidden xl:flex flex-col gap-4 w-64 shrink-0">

      {/* Join card — only shown when logged out */}
      {!user && (
        <div className="bg-white dark:bg-[#0f1a35] border border-gray-200 dark:border-[#1e3a5f] rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base mb-1" style={{ fontFamily: 'var(--font-sora), Sora, sans-serif' }}>
                Join CampusMart
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Create an account to buy, sell, and connect with students on campus.
              </p>
            </div>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="#eff6ff"/>
              <path d="M20 8 L28 14 L28 26 L20 32 L12 26 L12 14 Z" fill="#2563eb" opacity="0.2"/>
              <path d="M20 8 L28 14 L28 26 L20 32 L12 26 L12 14 Z" stroke="#2563eb" strokeWidth="1.5" fill="none"/>
              <circle cx="20" cy="18" r="4" fill="#2563eb"/>
              <path d="M13 28 Q16 22 20 22 Q24 22 27 28" fill="#2563eb" opacity="0.6"/>
            </svg>
          </div>
          <Link href="/register" className="block text-center text-sm font-semibold text-white rounded-xl mb-2" style={{ background: '#2563eb', padding: '10px' }}>
            Sign Up
          </Link>
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Log in</Link>
          </p>
        </div>
      )}

      {/* Why CampusMart — always shown */}
      <div className="bg-white dark:bg-[#0f1a35] border border-gray-200 dark:border-[#1e3a5f] rounded-2xl p-5">
        <h3 className="font-bold text-gray-900 dark:text-white text-base mb-3" style={{ fontFamily: 'var(--font-sora), Sora, sans-serif' }}>
          Why CampusMart?
        </h3>
        <div className="space-y-2.5">
          {whyCampusMart.map(item => (
            <div key={item} className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-xs text-gray-600 dark:text-gray-400">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}