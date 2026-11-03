'use client'
import {useCallback} from 'react'
import {useRouter} from 'next/navigation'
import {useVisibleRefresh} from '@/hooks/useVisibleRefresh'
export default function InboxRefresh(){const router=useRouter();const refresh=useCallback(()=>router.refresh(),[router]);useVisibleRefresh(refresh,30000);return null}
