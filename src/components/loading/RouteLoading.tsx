'use client'
import { usePathname } from 'next/navigation'
import { loadingVariant } from '@/lib/loading-routes'
import PageSkeleton from './PageSkeleton'
export default function RouteLoading() { return <PageSkeleton kind={loadingVariant(usePathname() ?? '/')} /> }
