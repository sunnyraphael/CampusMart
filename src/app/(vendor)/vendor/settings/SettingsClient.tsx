'use client'

import { useMemo, useState, useEffect, useSyncExternalStore } from 'react'
import {
  Store,
  ImagePlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Landmark,
  MapPin,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeading } from '@/components/vendor/Workspace'
import ShareStoreButton from '@/components/vendor/ShareStoreButton'

type Seller = {
  id: string
  store_name: string
  description: string | null
  logo_url: string | null
  category: string | null
  phone: string | null
  whatsapp: string | null
  state: string | null
  campus: string | null
  is_kyc_verified: boolean | null
  kyc_status: string
  kyc_rejection_reason: string | null
}

type Section = 'profile' | 'contact'
type Status = { busy: boolean; ok: boolean; err: string | null }

const CATEGORIES = [
  'Electronics & Gadgets', 'Books & Stationery', 'Fashion & Clothing',
  'Food & Drinks', 'Phones & Accessories', 'Hostel & Room Items',
  'Beauty & Grooming', 'Services', 'Sports & Fitness', 'Other',
]

const STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo',
  'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe', 'Imo', 'Jigawa',
  'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

const PHONE_RE = /^(\+234|0)[789][01]\d{8}$/
const idle: Status = { busy: false, ok: false, err: null }

// True when every field matches its saved value (ignoring spaces at the ends)
const same = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).every((k) => (a[k] ?? '').trim() === (b[k] ?? '').trim())

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="ss-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="ss-hint">{hint}</span>}
    </div>
  )
}

function SaveBar({
  status,
  disabled,
  onSave,
  label = 'Save changes',
}: {
  status: Status
  disabled: boolean
  onSave: () => void
  label?: string
}) {
  return (
    <div className="ss-savebar">
      <div className="ss-msg">
        {status.err && (
          <span className="ss-err" role="alert">
            <AlertCircle size={15} aria-hidden /> {status.err}
          </span>
        )}
        {status.ok && (
          <span className="ss-ok" role="status">
            <CheckCircle2 size={15} aria-hidden /> Saved
          </span>
        )}
      </div>
      <button className="ss-btn" onClick={onSave} disabled={disabled || status.busy}>
        {status.busy && <Loader2 size={15} className="ss-spin" aria-hidden />}
        {label}
      </button>
    </div>
  )
}

const settingsSections=[{id:'store-profile',label:'Store profile',icon:Store},{id:'contact',label:'Contact & location',icon:MapPin},{id:'payout',label:'Payout account',icon:Landmark},{id:'store-controls',label:'Store controls',icon:ShieldAlert}]
function readSection(){const hash=window.location.hash.slice(1);return settingsSections.some(s=>s.id===hash)?hash:'store-profile'}
function subscribeSection(listener:()=>void){window.addEventListener('hashchange',listener);return ()=>window.removeEventListener('hashchange',listener)}
function selectSection(id:string){window.history.replaceState(window.history.state,'','#'+id);window.dispatchEvent(new Event('hashchange'))}
export default function SettingsClient({ seller,controls }: { seller: Seller;controls:React.ReactNode }) {
  const hashSection=useSyncExternalStore(subscribeSection,readSection,()=> 'store-profile')
  const [selectedSection,setSelectedSection]=useState<string|null>(null)
  const activeSection=selectedSection??hashSection
  function switchSection(id:string){setSelectedSection(id);selectSection(id)}
  const supabase = useMemo(() => createClient(), [])

  // Each section keeps its saved copy (base) and its editable copy
  const startProfile = {
    store_name: seller.store_name ?? '',
    description: seller.description ?? '',
    category: seller.category ?? '',
  }
  const startContact = {
    phone: seller.phone ?? '',
    whatsapp: seller.whatsapp ?? '',
    state: seller.state ?? '',
    campus: seller.campus ?? '',
  }
  const [profileBase, setProfileBase] = useState(startProfile)
  const [profile, setProfile] = useState(startProfile)
  const [contactBase, setContactBase] = useState(startContact)
  const [contact, setContact] = useState(startContact)

  const [logoUrl, setLogoUrl] = useState(seller.logo_url)
  useEffect(()=>{const update=(e:Event)=>setLogoUrl((e as CustomEvent<string|null>).detail);window.addEventListener("campusmart:store-logo",update);return ()=>window.removeEventListener("campusmart:store-logo",update)},[])
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoErr, setLogoErr] = useState<string | null>(null)

  const [status, setStatus] = useState<Record<Section, Status>>({
    profile: idle,
    contact: idle,

  })

  // Runs a save, tracks busy/ok/error for that section, hides "Saved" after 3 seconds
  async function run(section: Section, job: () => Promise<void>) {
    setStatus((s) => ({ ...s, [section]: { busy: true, ok: false, err: null } }))
    try {
      await job()
      setStatus((s) => ({ ...s, [section]: { busy: false, ok: true, err: null } }))
      setTimeout(() => setStatus((s) => ({ ...s, [section]: idle })), 3000)
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Something went wrong. Please try again.'
      setStatus((s) => ({ ...s, [section]: { busy: false, ok: false, err } }))
    }
  }

  // The one place that writes to the database
  async function saveFields(fields: Record<string, string | null>) {
    const { data, error } = await supabase
      .from('sellers')
      .update(fields)
      .eq('id', seller.id)
      .select('id')
    if (error) throw new Error(error.message)
    // A blocked update returns no error but also no rows, so we check for that
    if (!data || data.length === 0) throw new Error('Nothing was saved. You may not have permission to change this.')
  }

  function saveProfile() {
    run('profile', async () => {
      const name = profile.store_name.trim()
      const desc = profile.description.trim()
      if (name.length < 3) throw new Error('Store name must be at least 3 characters')
      if (desc.length < 20) throw new Error('Description must be at least 20 characters')
      if (!profile.category) throw new Error('Please select a category')
      const next = { store_name: name, description: desc, category: profile.category }
      await saveFields(next)
      setProfileBase(next)
      setProfile(next)
    })
  }

  function saveContact() {
    run('contact', async () => {
      const phone = contact.phone.trim()
      const whatsapp = contact.whatsapp.trim()
      if (!PHONE_RE.test(phone)) throw new Error('Enter a valid Nigerian phone number')
      if (whatsapp && !PHONE_RE.test(whatsapp)) throw new Error('Enter a valid WhatsApp number, or leave it empty')
      if (!contact.state) throw new Error('Please select your state')
      if (!contact.campus.trim()) throw new Error('Campus or location is required')
      await saveFields({ phone, whatsapp: whatsapp || null, state: contact.state, campus: contact.campus.trim() })
      const next = { phone, whatsapp, state: contact.state, campus: contact.campus.trim() }
      setContactBase(next)
      setContact(next)
    })
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // lets the vendor pick the same file again later
    if (!file) return
    if (!file.type.startsWith('image/')) return setLogoErr('Please choose an image file')
    if (file.size > 2 * 1024 * 1024) return setLogoErr('Logo must be under 2MB')

    setLogoBusy(true)
    setLogoErr(null)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      // Same folder convention as product photos: sellerId first
      const path = `${seller.id}/logo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, file)
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      await saveFields({ logo_url: data.publicUrl })
      setLogoUrl(data.publicUrl)
      window.dispatchEvent(new CustomEvent("campusmart:store-logo",{detail:data.publicUrl}))
    } catch (err) {
      setLogoErr(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLogoBusy(false)
    }
  }

  const profileDirty = !same(profile, profileBase)
  const contactDirty = !same(contact, contactBase)

  // Verification card content, chosen from the seller's kyc fields
  const kyc = (seller.kyc_status ?? '').toLowerCase()
  const verified = seller.is_kyc_verified || ['approved', 'verified'].includes(kyc)
  const reviewing = ['pending', 'submitted', 'in_review'].includes(kyc)
  const rejected = kyc === 'rejected'

  return (
    <div className="ss-page">


      <PageHeading eyebrow="Make it yours" title="Store settings" description="The details that help buyers get to know your business." actions={<ShareStoreButton sellerId={seller.id} />} />
      <div className="vx-settings-grid"><aside className="vx-settings-index"><p className="vx-eyebrow">Store essentials</p><nav role="tablist" aria-label="Settings sections" onKeyDown={e=>{const index=settingsSections.findIndex(s=>s.id===activeSection);const next=e.key==='ArrowRight'||e.key==='ArrowDown'?(index+1)%4:e.key==='ArrowLeft'||e.key==='ArrowUp'?(index+3)%4:e.key==='Home'?0:e.key==='End'?3:-1;if(next<0)return;e.preventDefault();switchSection(settingsSections[next].id);document.getElementById('settings-tab-'+settingsSections[next].id)?.focus()}}>{settingsSections.map(({id,label,icon:Icon})=><button key={id} type="button" role="tab" id={'settings-tab-'+id} aria-controls={id} aria-selected={activeSection===id} tabIndex={activeSection===id?0:-1} onClick={()=>switchSection(id)}><Icon size={16} aria-hidden/>{label}</button>)}</nav><p className="vx-settings-tip">Keep these details current. Your store profile and location help buyers know who they are ordering from.</p><Link className="vx-text-link" href={`/vendors/${seller.id}`}>Preview your storefront</Link></aside><div className="vx-settings-body">

      {/* Verification */}
      <section className={`ss-card ss-verify ${verified ? 'is-ok' : rejected ? 'is-bad' : ''}`} aria-label="Verification status" hidden={activeSection!=='store-profile'}>
        <div className="ss-verify-icon" aria-hidden>
          {verified ? <ShieldCheck size={22} /> : rejected ? <ShieldAlert size={22} /> : reviewing ? <Clock size={22} /> : <ShieldCheck size={22} />}
        </div>
        <div>
          <h2 className="ss-verify-title">
            {verified ? 'Identity verified' : rejected ? 'Verification not approved' : reviewing ? 'Verification under review' : 'Identity not verified yet'}
          </h2>
          <p className="ss-verify-text">
            {verified && 'Your store has earned its trust badge.'}
            {rejected && (seller.kyc_rejection_reason || 'Your documents could not be approved. You will be able to resubmit soon.')}
            {reviewing && 'We are reviewing your documents. You will see the result here.'}
            {!verified && !rejected && !reviewing && 'Verification is how stores earn their trust badge. It only takes a selfie and your school ID.'}
          </p>
          {!verified && !reviewing && (
            <Link href="/vendor/verify" className="ss-btn-ghost" style={{ marginTop: 12, textDecoration: 'none' }}>
              {rejected ? 'Resubmit documents' : 'Verify identity'}
            </Link>
          )}
        </div>
      </section>

      {/* Store profile */}
      <section hidden={activeSection!=='store-profile'} role="tabpanel" tabIndex={0} id="store-profile" className="ss-card" aria-labelledby="ss-profile-title">
        <h2 id="ss-profile-title" className="ss-title">
          <Store size={17} aria-hidden /> Store profile
        </h2>

        <div className="ss-logo">
          <div className="ss-logo-box">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Your store logo" />
            ) : (
              <Store size={26} strokeWidth={1.5} aria-hidden />
            )}
          </div>
          <div className="ss-logo-side">
            <label className={`ss-btn-ghost ${logoBusy ? 'is-busy' : ''}`}>
              {logoBusy ? <Loader2 size={15} className="ss-spin" aria-hidden /> : <ImagePlus size={15} aria-hidden />}
              {logoUrl ? 'Change logo' : 'Upload logo'}
              <input type="file" accept="image/*" onChange={handleLogo} disabled={logoBusy} hidden />
            </label>
            <span className="ss-hint">Square image works best. Maximum 2MB.</span>
            {logoErr && (
              <span className="ss-err" role="alert">
                <AlertCircle size={15} aria-hidden /> {logoErr}
              </span>
            )}
          </div>
        </div>

        <Field id="store_name" label="Store name">
          <input
            id="store_name"
            value={profile.store_name}
            onChange={(e) => setProfile({ ...profile, store_name: e.target.value })}
            maxLength={60}
          />
        </Field>
        <Field id="description" label="Description" hint={`${profile.description.trim().length}/500 characters. At least 20.`}>
          <textarea
            id="description"
            rows={4}
            value={profile.description}
            onChange={(e) => setProfile({ ...profile, description: e.target.value })}
            maxLength={500}
          />
        </Field>
        <Field id="category" label="Category">
          <select id="category" value={profile.category} onChange={(e) => setProfile({ ...profile, category: e.target.value })}>
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <SaveBar status={status.profile} disabled={!profileDirty} onSave={saveProfile} />
      </section>

      {/* Contact and location */}
      <section hidden={activeSection!=='contact'} role="tabpanel" tabIndex={0} id="contact" className="ss-card" aria-labelledby="ss-contact-title">
        <h2 id="ss-contact-title" className="ss-title">
          <MapPin size={17} aria-hidden /> Contact and location
        </h2>
        <div className="ss-grid">
          <Field id="phone" label="Phone number" hint="Used for delivery and order updates.">
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              value={contact.phone}
              onChange={(e) => setContact({ ...contact, phone: e.target.value })}
            />
          </Field>
          <Field id="whatsapp" label="WhatsApp (optional)">
            <input
              id="whatsapp"
              type="tel"
              inputMode="tel"
              value={contact.whatsapp}
              onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })}
            />
          </Field>
          <Field id="state" label="State">
            <select id="state" value={contact.state} onChange={(e) => setContact({ ...contact, state: e.target.value })}>
              <option value="">Select a state</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field id="campus" label="Campus or location">
            <input id="campus" value={contact.campus} onChange={(e) => setContact({ ...contact, campus: e.target.value })} />
          </Field>
        </div>
        <SaveBar status={status.contact} disabled={!contactDirty} onSave={saveContact} />
      </section>

      {/* Payout account */}
      <section hidden={activeSection!=='payout'} role="tabpanel" tabIndex={0} id="payout" className="ss-card" aria-labelledby="ss-payout-title"><h2 id="ss-payout-title" className="ss-title"><Landmark size={17} aria-hidden/>Payout account</h2><p className="buyer-help">Resolve your bank account with Paystack. Typed legacy bank details are not used for transfers; changing a resolved account requires a recent sign-in.</p><Link href="/vendor/payout-account" className="buyer-btn">Manage Paystack payout account</Link></section>
      <div id="store-controls" role="tabpanel" aria-labelledby="settings-tab-store-controls" tabIndex={0} hidden={activeSection!=='store-controls'}>{controls}</div>
      </div></div>
    </div>
  )
}
