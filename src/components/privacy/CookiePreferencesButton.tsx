'use client'
import type { ButtonHTMLAttributes } from 'react'
import { COOKIE_PREFERENCES_EVENT } from '@/lib/privacy/cookies'

export default function CookiePreferencesButton({children='Cookie preferences',...props}:ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} onClick={event=>{props.onClick?.(event);if(!event.defaultPrevented)window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT))}}>{children}</button>
}
