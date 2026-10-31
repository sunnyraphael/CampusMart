import Link from 'next/link'
import { Bell, Bookmark, Heart, MessageCircle, Settings, ShoppingBag } from 'lucide-react'
import { BuyerPage, DataError } from '@/components/buyer/Page'
import { buyerSession } from '@/lib/buyer/server'
import ProfileForm from './ProfileForm'

const links=[{href:'/orders',name:'My orders',icon:ShoppingBag},{href:'/wishlist',name:'Favorites',icon:Heart},{href:'/saved',name:'Saved searches',icon:Bookmark},{href:'/messages',name:'Messages',icon:MessageCircle},{href:'/notifications',name:'Notifications',icon:Bell},{href:'/settings',name:'Account settings',icon:Settings}]

export default async function ProfilePage() {
  const {supabase,user}=await buyerSession('/profile')
  const {data,error}=await supabase.from('users').select('full_name,phone,email').eq('id',user.id).maybeSingle()
  return <BuyerPage title="Your account" description="Manage your details and everything you have saved on CampusMart.">
    <nav className="buyer-links" aria-label="Your account">{links.map(({href,name,icon:Icon})=><Link className="buyer-link lift" key={href} href={href}><Icon size={20} aria-hidden="true" />{name}</Link>)}</nav>
    {error || !data ? <DataError /> : <div className="buyer-panel"><h2>Personal details</h2><ProfileForm name={data.full_name??''} phone={data.phone??''} email={user.email??data.email} /></div>}
  </BuyerPage>
}
