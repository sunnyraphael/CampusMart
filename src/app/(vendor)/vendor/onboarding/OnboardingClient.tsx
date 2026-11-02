'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  CheckCircle2, ArrowRight, ArrowLeft, Store, User, Building2, FileCheck,
  ShieldCheck, CreditCard, AlertCircle,
} from 'lucide-react'

const STORE_CATEGORIES = [
  'Electronics & Gadgets',
  'Books & Stationery',
  'Fashion & Clothing',
  'Food & Drinks',
  'Phones & Accessories',
  'Hostel & Room Items',
  'Beauty & Grooming',
  'Services',
  'Sports & Fitness',
  'Other',
]

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo',
  'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe', 'Imo', 'Jigawa',
  'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

const steps = [
  { number: 1, label: 'Store Info',   icon: Store },
  { number: 2, label: 'Contact',      icon: User },
  { number: 3, label: 'Payout setup', icon: Building2 },
  { number: 4, label: 'Agreement',    icon: FileCheck },
]

interface FormData {
  // Step 1
  store_name: string
  description: string
  category: string
  // Step 2
  phone: string
  state: string
  campus: string
  // Step 4
  items_genuine: boolean
  agree_terms: boolean
  agree_commission: boolean
}

export default function VendorOnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<FormData>({
    store_name: '', description: '', category: '',
    phone: '', state: '', campus: '',
    items_genuine: false, agree_terms: false, agree_commission: false,
  })

  function update(field: keyof FormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  // Validates each step before allowing next
  function validateStep(): string | null {
    if (currentStep === 1) {
      if (!form.store_name.trim()) return 'Store name is required'
      if (form.store_name.trim().length < 3) return 'Store name must be at least 3 characters'
      if (!form.description.trim()) return 'Store description is required'
      if (form.description.trim().length < 20) return 'Description must be at least 20 characters'
      if (!form.category) return 'Please select a store category'
    }
    if (currentStep === 2) {
      if (!form.phone.trim()) return 'Phone number is required'
      if (!/^(\+234|0)[789][01]\d{8}$/.test(form.phone.trim())) return 'Enter a valid Nigerian phone number'
      if (!form.state) return 'Please select your state'
      if (!form.campus.trim()) return 'Campus or location is required'
    }
    if (currentStep === 4) {
      if (!form.items_genuine) return 'You must confirm your items are genuine'
      if (!form.agree_terms) return 'You must agree to the Terms of Service'
      if (!form.agree_commission) return 'You must acknowledge the commission structure'
    }
    return null
  }

  function handleNext() {
    const err = validateStep()
    if (err) { setError(err); return }
    setCurrentStep(s => s + 1)
    setError('')
  }

  function handleBack() {
    setCurrentStep(s => s - 1)
    setError('')
  }

  async function handleSubmit() {
    const err = validateStep()
    if (err) { setError(err); return }

    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Check if seller row already exists for this user
      const { data: existingSeller, error: lookupError } = await supabase
        .from('sellers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (lookupError) throw lookupError
      if (existingSeller) {
        // Another tab may have finished setup since this form was opened.
        router.replace('/vendor/dashboard')
        router.refresh()
        return
      } else {
        // Insert new seller row for this vendor
        const { error: insertError } = await supabase
          .from('sellers')
          .insert({
            user_id: user.id,
            store_name: form.store_name.trim(),
            description: form.description.trim(),
            category: form.category,
            phone: form.phone.trim(),
            state: form.state,
            campus: form.campus.trim(),
          })

        if (insertError) throw insertError
      }

      // All done — send them to their dashboard
      router.push('/vendor/dashboard')

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>


      <div className="ob-page">

        {/* Header */}
        <div className="ob-header">
          <Link href="/" className="ob-logo">CampusMart</Link>
          <h1 className="ob-title">Set up your store</h1>
          <p className="ob-sub">Complete these steps to start selling on CampusMart</p>
        </div>

        {/* Step indicators */}
        <div className="ob-steps">
          {steps.map((step) => {
            const Icon = step.icon
            const isDone = currentStep > step.number
            const isActive = currentStep === step.number
            return (
              <div key={step.number} aria-current={isActive ? 'step' : undefined} className={`ob-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}>
                <div className="ob-step-circle">
                  {isDone ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </div>
                <span className="ob-step-label">{step.label}</span>
                <div className="ob-step-line" />
              </div>
            )
          })}
        </div>

        {/* Form card */}
        <div className="ob-card">

          {/* ── Step 1: Store Info ── */}
          {currentStep === 1 && (
            <>
              <h2 className="ob-card-title">Tell us about your store</h2>
              <p className="ob-card-sub">This is what buyers will see when they visit your store page.</p>

              <div className="ob-field">
                <label className="ob-label" htmlFor="ob-store-name">Store name <span>*</span></label>
                <input
                  id="ob-store-name"
                  className="ob-input"
                  placeholder="e.g. Raphael's Gadget Hub"
                  value={form.store_name}
                  onChange={e => update('store_name', e.target.value)}
                  maxLength={60}
                />
                <p className="ob-hint">This will appear as your public store name on CampusMart.</p>
              </div>

              <div className="ob-field">
                <label className="ob-label" htmlFor="ob-description">Store description <span>*</span></label>
                <textarea
                  id="ob-description"
                  className="ob-textarea"
                  placeholder="Tell buyers what you sell, your campus, and why they should buy from you..."
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  maxLength={300}
                />
                <p className="ob-hint">{form.description.length}/300 characters. Minimum 20.</p>
              </div>

              <div className="ob-field">
                <label className="ob-label" htmlFor="ob-category">Main category <span>*</span></label>
                <select
                  id="ob-category"
                  className="ob-select"
                  value={form.category}
                  onChange={e => update('category', e.target.value)}
                >
                  <option value="">Select what you mainly sell...</option>
                  {STORE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="ob-hint">You can still list products in other categories.</p>
              </div>
            </>
          )}

          {/* ── Step 2: Contact ── */}
          {currentStep === 2 && (
            <>
              <h2 className="ob-card-title">Your contact details</h2>
              <p className="ob-card-sub">Buyers and order updates reach you through these.</p>

              <div className="ob-info-box">
                <div className="ob-info-row">
                  <ShieldCheck size={16} />
                  <p>
                    You can submit your identity documents from the verification page after setting up your store.
                    You will need a clear selfie and a photo of your school ID card.
                  </p>
                </div>
              </div>

              <div className="ob-field">
                <label className="ob-label" htmlFor="ob-phone">Phone number <span>*</span></label>
                <input
                  id="ob-phone"
                  className="ob-input"
                  placeholder="e.g. 08012345678"
                  value={form.phone}
                  onChange={e => update('phone', e.target.value)}
                  type="tel"
                  maxLength={14}
                />
                <p className="ob-hint">Used to coordinate orders and contact you about your store.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="ob-field">
                  <label className="ob-label" htmlFor="ob-state">State <span>*</span></label>
                  <select
                    id="ob-state"
                    className="ob-select"
                    value={form.state}
                    onChange={e => update('state', e.target.value)}
                  >
                    <option value="">Select state...</option>
                    {NIGERIAN_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="ob-field">
                  <label className="ob-label" htmlFor="ob-campus">Campus / Area <span>*</span></label>
                  <input
                    id="ob-campus"
                    className="ob-input"
                    placeholder="e.g. UNILAG, Yaba"
                    value={form.campus}
                    onChange={e => update('campus', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: Bank Details ── */}
          {currentStep === 3 && (
            <>
              <h2 className="ob-card-title">Payout information</h2>
              <p className="ob-card-sub">You can open your store without providing a bank account today.</p>
              <div className="ob-info-box"><div className="ob-info-row"><CreditCard size={18} aria-hidden/><div><p>When Paystack is configured, add a resolved payout account from your earnings page before an administrator sends approved earnings. You can open the store without collecting bank details here. Do not send bank credentials, PINs or card details.</p><p>For real sales, vendor credit requires verified payment, a delivery code, buyer receipt confirmation and a separate admin approval.</p><p>CampusMart deducts a <strong>5% commission</strong> from the item subtotal on an approved completed real sale. Trial orders do not create real earnings.</p></div></div></div>
              <p className="ob-hint">Your bank details are not collected in this setup. <Link href="/vendor-terms">Review vendor terms</Link> and the <Link href="/refunds">refund policy</Link> before you continue.</p>
            </>
          )}

          {/* Agreement is separate from the age and terms records checked on the server. */}
          {currentStep === 4 && (
            <>
              <h2 className="ob-card-title">Review & agree</h2>
              <p className="ob-card-sub">Please read and confirm each statement before submitting.</p>

              <p className="ob-hint">Opening a store requires an adult account or reviewed guardian permission that explicitly allows selling. Review these commitments before opening your store.</p>
              {[
                {field:'items_genuine' as const,label:<>I will list products that are <strong>genuine, accurately described and legally obtained</strong>, and will not list counterfeit, stolen or prohibited items.</>},
                {field:'agree_terms' as const,label:<>I have read and agree to the <Link href="/vendor-terms">vendor terms</Link>, the <Link href="/refunds">refund policy</Link> and the <Link href="/privacy">privacy policy</Link>.</>},
                {field:'agree_commission' as const,label:<>I understand the <strong>5% sales commission</strong> and that vendor credit requires delivery review and admin approval. Trial orders never create real earnings.</>},
              ].map(({field,label})=><label key={field} className={`ob-check-row${form[field]?' checked':''}`}><input type="checkbox" checked={form[field]} onChange={e=>update(field,e.target.checked)}/><span className="ob-check-label">{label}</span></label>)}
            </>
          )}

          {/* Error message */}
          {error && (
            <div className="ob-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="ob-btn-row">
            {currentStep > 1 && (
              <button className="ob-btn-back" onClick={handleBack}>
                <ArrowLeft size={16} /> Back
              </button>
            )}
            {currentStep < 4 ? (
              <button className="ob-btn-next" onClick={handleNext}>
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="ob-btn-next"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Setting up your store...' : 'Launch my store'}
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
