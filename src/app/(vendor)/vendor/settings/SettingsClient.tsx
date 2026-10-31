'use client'

import { useMemo, useState } from 'react'
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
  bank_name: string | null
  account_number: string | null
  account_name: string | null
  is_kyc_verified: boolean | null
  kyc_status: string
  kyc_rejection_reason: string | null
}

type Section = 'profile' | 'contact' | 'payout'
type Status = { busy: boolean; ok: boolean; err: string | null }

const BANKS = [
  'Access Bank', 'Citibank', 'Ecobank', 'Fidelity Bank',
  'First Bank of Nigeria', 'First City Monument Bank (FCMB)',
  'Globus Bank', 'Guaranty Trust Bank (GTB)', 'Heritage Bank',
  'Keystone Bank', 'Kuda Bank', 'Moniepoint',
  'Opay', 'Palmpay', 'Parallex Bank', 'Polaris Bank',
  'Providus Bank', 'Stanbic IBTC Bank', 'Standard Chartered',
  'Sterling Bank', 'Suntrust Bank', 'Titan Trust Bank',
  'Union Bank', 'United Bank for Africa (UBA)', 'Unity Bank',
  'VFD Microfinance Bank', 'Wema Bank', 'Zenith Bank',
]

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

const mask = (n: string | null) => (n ? '•••• ' + n.slice(-4) : '')

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

export default function SettingsClient({ seller }: { seller: Seller }) {
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

  const [payoutBase, setPayoutBase] = useState({
    bank_name: seller.bank_name ?? '',
    account_number: seller.account_number ?? '',
    account_name: seller.account_name ?? '',
  })
  const [payout, setPayout] = useState({ bank_name: '', account_number: '', account_name: '' })
  const [editingPayout, setEditingPayout] = useState(!seller.account_number)
  const [confirmPayout, setConfirmPayout] = useState(false)

  const [logoUrl, setLogoUrl] = useState(seller.logo_url)
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoErr, setLogoErr] = useState<string | null>(null)

  const [status, setStatus] = useState<Record<Section, Status>>({
    profile: idle,
    contact: idle,
    payout: idle,
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

  function savePayout() {
    run('payout', async () => {
      if (!payout.bank_name) throw new Error('Please select your bank')
      if (!/^\d{10}$/.test(payout.account_number)) throw new Error('Account number must be exactly 10 digits')
      if (payout.account_name.trim().length < 3) throw new Error('Enter the account name exactly as your bank has it')
      if (!confirmPayout) throw new Error('Please tick the box to confirm the change')
      const next = {
        bank_name: payout.bank_name,
        account_number: payout.account_number,
        account_name: payout.account_name.trim(),
      }
      await saveFields(next)
      setPayoutBase(next)
      setEditingPayout(false)
      setConfirmPayout(false)
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
      <div className="vx-settings-grid"><aside className="vx-settings-index"><p className="vx-eyebrow">Store essentials</p><nav aria-label="Settings sections"><a href="#store-profile"><Store size={16} />Store profile</a><a href="#contact"><MapPin size={16} />Contact &amp; location</a><a href="#payout"><Landmark size={16} />Payout account</a></nav><p className="vx-settings-tip">Keep these details current. Your store profile and location help buyers know who they are ordering from.</p><Link className="vx-text-link" href={`/vendors/${seller.id}`}>Preview your storefront</Link></aside><div className="vx-settings-body">

      {/* Verification */}
      <section className={`ss-card ss-verify ${verified ? 'is-ok' : rejected ? 'is-bad' : ''}`} aria-label="Verification status">
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
      <section id="store-profile" className="ss-card" aria-labelledby="ss-profile-title">
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
      <section id="contact" className="ss-card" aria-labelledby="ss-contact-title">
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
      <section id="payout" className="ss-card" aria-labelledby="ss-payout-title">
        <h2 id="ss-payout-title" className="ss-title">
          <Landmark size={17} aria-hidden /> Payout account
        </h2>

        {!editingPayout ? (
          <>
            <dl className="ss-account">
              <div><dt>Bank</dt><dd>{payoutBase.bank_name}</dd></div>
              <div><dt>Account number</dt><dd>{mask(payoutBase.account_number)}</dd></div>
              <div><dt>Account name</dt><dd>{payoutBase.account_name}</dd></div>
            </dl>
            <button
              className="ss-btn-ghost"
              onClick={() => {
                setPayout({ bank_name: payoutBase.bank_name, account_number: '', account_name: '' })
                setEditingPayout(true)
              }}
            >
              Change payout account
            </button>
          </>
        ) : (
          <>
            <div className="ss-warn">
              <AlertCircle size={16} aria-hidden />
              <span>The new account is used for future payouts only. Check every detail, because money sent to a wrong account cannot be recovered.</span>
            </div>
            <Field id="bank_name" label="Bank">
              <select id="bank_name" value={payout.bank_name} onChange={(e) => setPayout({ ...payout, bank_name: e.target.value })}>
                <option value="">Select your bank</option>
                {BANKS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </Field>
            <div className="ss-grid">
              <Field id="account_number" label="Account number">
                <input
                  id="account_number"
                  inputMode="numeric"
                  maxLength={10}
                  value={payout.account_number}
                  onChange={(e) => setPayout({ ...payout, account_number: e.target.value.replace(/\D/g, '') })}
                />
              </Field>
              <Field id="account_name" label="Account name" hint="Exactly as your bank has it.">
                <input id="account_name" value={payout.account_name} onChange={(e) => setPayout({ ...payout, account_name: e.target.value })} />
              </Field>
            </div>
            <label className="ss-check">
              <input type="checkbox" checked={confirmPayout} onChange={(e) => setConfirmPayout(e.target.checked)} />
              <span>I have checked these details and want to use this account for future payouts.</span>
            </label>
            <SaveBar status={status.payout} disabled={false} onSave={savePayout} label="Save payout account" />
            {payoutBase.account_number && (
              <button
                className="ss-link"
                onClick={() => {
                  setEditingPayout(false)
                  setConfirmPayout(false)
                  setStatus((s) => ({ ...s, payout: idle }))
                }}
              >
                Cancel
              </button>
            )}
          </>
        )}
      </section>
      </div></div>
    </div>
  )
}
