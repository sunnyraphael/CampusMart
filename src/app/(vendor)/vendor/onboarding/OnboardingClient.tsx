'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  CheckCircle2, ArrowRight, ArrowLeft, Store, User, Building2, FileCheck,
  ShieldCheck, CreditCard, AlertCircle,
} from 'lucide-react'

const NIGERIAN_BANKS = [
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
  { number: 3, label: 'Bank Details', icon: Building2 },
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
  // Step 3
  bank_name: string
  account_number: string
  account_name: string
  // Step 4
  is_18: boolean
  items_genuine: boolean
  agree_terms: boolean
  agree_commission: boolean
  signature: string
}

export default function VendorOnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<FormData>({
    store_name: '', description: '', category: '',
    phone: '', state: '', campus: '',
    bank_name: '', account_number: '', account_name: '',
    is_18: false, items_genuine: false, agree_terms: false,
    agree_commission: false, signature: '',
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
    if (currentStep === 3) {
      if (!form.bank_name) return 'Please select your bank'
      if (!/^\d{10}$/.test(form.account_number)) return 'Account number must be exactly 10 digits'
      if (form.account_name.trim().length < 3) return 'Enter the account name exactly as your bank has it'
    }
    if (currentStep === 4) {
      if (!form.is_18) return 'You must confirm you are 18 years or older'
      if (!form.items_genuine) return 'You must confirm your items are genuine'
      if (!form.agree_terms) return 'You must agree to the Terms of Service'
      if (!form.agree_commission) return 'You must acknowledge the commission structure'
      if (!form.signature.trim()) return 'Please type your full name as signature'
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
            bank_name: form.bank_name,
            account_number: form.account_number,
            account_name: form.account_name.trim(),
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
      <style>{`
        .ob-page {
          min-height: 100vh;
          background: var(--page-bg);
          display: flex; flex-direction: column; align-items: center;
          padding: 40px 16px 80px;
          font-family: var(--font-dm-sans);
        }

        /* Header */
        .ob-header { text-align: center; margin-bottom: 36px; }
        .ob-logo {
          font-family: var(--font-sora); font-weight: 700; font-size: 1.3rem;
          color: #2563eb; text-decoration: none; display: inline-block; margin-bottom: 20px;
        }
        .ob-title { font-family: var(--font-sora); font-size: 1.5rem; font-weight: 700; color: var(--ob-heading, #fff); margin: 0 0 6px; }
        .ob-sub { font-size: 0.875rem; color: var(--ob-muted, #64748b); margin: 0; }

        /* Step indicators */
        .ob-steps { display: flex; align-items: center; gap: 0; margin-bottom: 36px; width: 100%; max-width: 560px; }
        .ob-step { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; position: relative; }
        .ob-step-circle {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.8rem; font-weight: 700; font-family: var(--font-sora);
          border: 2px solid var(--ob-border, #1e3a5f);
          background: var(--ob-card, #0f1a35);
          color: var(--ob-muted, #64748b);
          transition: all 0.3s; z-index: 1;
        }
        .ob-step.active .ob-step-circle { border-color: #2563eb; background: #2563eb; color: white; }
        .ob-step.done .ob-step-circle { border-color: #22c55e; background: #22c55e; color: white; }
        .ob-step-label { font-size: 0.7rem; color: var(--ob-muted, #64748b); white-space: nowrap; }
        .ob-step.active .ob-step-label { color: #2563eb; font-weight: 600; }
        .ob-step.done .ob-step-label { color: #22c55e; }
        .ob-step-line {
          position: absolute; top: 18px; left: calc(50% + 18px);
          width: calc(100% - 36px); height: 2px;
          background: var(--ob-border, #1e3a5f);
          transition: background 0.3s;
        }
        .ob-step.done .ob-step-line { background: #22c55e; }
        .ob-step:last-child .ob-step-line { display: none; }

        /* Card */
        .ob-card {
          background: var(--ob-card, #0f1a35);
          border: 1px solid var(--ob-border, #1e3a5f);
          border-radius: 16px; padding: 28px;
          width: 100%; max-width: 560px;
        }
        .ob-card-title {
          font-family: var(--font-sora); font-size: 1rem; font-weight: 700;
          color: var(--ob-heading, #fff); margin: 0 0 6px;
        }
        .ob-card-sub { font-size: 0.82rem; color: var(--ob-muted, #64748b); margin: 0 0 24px; }

        /* Form fields */
        .ob-field { margin-bottom: 18px; }
        .ob-label {
          display: block; font-size: 0.82rem; font-weight: 600;
          color: var(--ob-heading, #fff); margin-bottom: 6px;
        }
        .ob-label span { color: #ef4444; margin-left: 2px; }
        .ob-input, .ob-select, .ob-textarea {
          width: 100%; padding: 10px 14px; border-radius: 8px;
          background: var(--ob-input-bg, #060d1f);
          border: 1.5px solid var(--ob-border, #1e3a5f);
          color: var(--ob-heading, #fff);
          font-family: var(--font-dm-sans); font-size: 0.875rem;
          outline: none; transition: border-color 0.2s;
          appearance: none;
        }
        .ob-input:focus, .ob-select:focus, .ob-textarea:focus { border-color: #2563eb; }
        .ob-input::placeholder { color: var(--ob-muted, #64748b); }
        .ob-textarea { resize: vertical; min-height: 90px; }
        .ob-hint { font-size: 0.75rem; color: var(--ob-muted, #64748b); margin-top: 5px; }
        .ob-hint a { color: #2563eb; }

        /* Checkbox rows */
        .ob-check-row {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 14px; border-radius: 10px;
          border: 1.5px solid var(--ob-border, #1e3a5f);
          margin-bottom: 12px; cursor: pointer;
          transition: border-color 0.2s;
        }
        .ob-check-row:hover { border-color: #2563eb; }
        .ob-check-row.checked { border-color: #2563eb; background: rgba(37,99,235,0.06); }
        .ob-checkbox {
          width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0; margin-top: 1px;
          border: 2px solid var(--ob-border, #1e3a5f);
          background: var(--ob-input-bg, #060d1f);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .ob-check-row.checked .ob-checkbox { background: #2563eb; border-color: #2563eb; }
        .ob-check-label { font-size: 0.85rem; color: var(--ob-heading, #fff); line-height: 1.5; }
        .ob-check-label strong { color: #2563eb; }

        /* Info box */
        .ob-info-box {
          background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.2);
          border-radius: 10px; padding: 14px; margin-bottom: 18px;
        }
        .ob-info-row { display: flex; align-items: flex-start; gap: 10px; }
        .ob-info-row svg { flex-shrink: 0; margin-top: 2px; color: #93c5fd; }
        .ob-info-row p { font-size: 0.8rem; color: #93c5fd; margin: 0; line-height: 1.6; }

        /* Error */
        .ob-error {
          display: flex; align-items: center; gap: 8px;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2);
          border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;
          font-size: 0.82rem; color: #fca5a5;
        }
        .ob-error svg { flex-shrink: 0; }

        /* Buttons */
        .ob-btn-row { display: flex; gap: 10px; margin-top: 24px; }
        .ob-btn-back {
          flex: 1; padding: 12px; border-radius: 10px;
          border: 1.5px solid var(--ob-border, #1e3a5f);
          background: transparent; color: var(--ob-muted, #94a3b8);
          font-family: var(--font-dm-sans); font-size: 0.875rem; font-weight: 600;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: all 0.2s;
        }
        .ob-btn-back:hover { border-color: #2563eb; color: #2563eb; }
        .ob-btn-next {
          flex: 2; padding: 12px; border-radius: 10px; border: none;
          background: #2563eb; color: white;
          font-family: var(--font-dm-sans); font-size: 0.875rem; font-weight: 600;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: all 0.2s;
        }
        .ob-btn-next:hover { background: #1d4ed8; }
        .ob-btn-next:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Light mode */
        html.light .ob-title, html[data-theme="light"] .ob-title { color: #0f172a; }
        html.light .ob-card, html[data-theme="light"] .ob-card { background: #ffffff; border-color: #e2e8f0; }
        html.light .ob-card-title, html[data-theme="light"] .ob-card-title { color: #0f172a; }
        html.light .ob-label, html[data-theme="light"] .ob-label { color: #0f172a; }
        html.light .ob-input, html.light .ob-select, html.light .ob-textarea,
        html[data-theme="light"] .ob-input, html[data-theme="light"] .ob-select, html[data-theme="light"] .ob-textarea {
          background: #f8fafc; border-color: #e2e8f0; color: #0f172a;
        }
        html.light .ob-check-row, html[data-theme="light"] .ob-check-row { border-color: #e2e8f0; }
        html.light .ob-check-label, html[data-theme="light"] .ob-check-label { color: #0f172a; }
        html.light .ob-step-circle, html[data-theme="light"] .ob-step-circle { background: #f8fafc; border-color: #e2e8f0; }
        html.light .ob-btn-back, html[data-theme="light"] .ob-btn-back { border-color: #e2e8f0; }
      `}</style>

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
                <p className="ob-hint">Must be a valid Nigerian number. Buyers will contact you on this.</p>
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
              <h2 className="ob-card-title">Bank details</h2>
              <p className="ob-card-sub">Save the bank account to use for payouts. This setup does not initiate a withdrawal.</p>

              <div className="ob-info-box">
                <div className="ob-info-row">
                  <CreditCard size={16} />
                  <p>
                    Each sale is added to your CampusMart wallet once the buyer confirms delivery,
                    or 3 days after you mark the item delivered if they do not respond.
                    CampusMart charges a <strong>5% commission</strong> on each sale, so you receive 95%.
                  </p>
                </div>
              </div>

              <div className="ob-field">
                <label className="ob-label" htmlFor="ob-bank">Bank name <span>*</span></label>
                <select
                  id="ob-bank"
                  className="ob-select"
                  value={form.bank_name}
                  onChange={e => update('bank_name', e.target.value)}
                >
                  <option value="">Select your bank...</option>
                  {NIGERIAN_BANKS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="ob-field">
                <label className="ob-label" htmlFor="ob-account-number">Account number <span>*</span></label>
                <input
                  id="ob-account-number"
                  className="ob-input"
                  placeholder="10-digit account number"
                  value={form.account_number}
                  onChange={e => update('account_number', e.target.value.replace(/\D/g, ''))}
                  maxLength={10}
                  type="tel"
                />
              </div>

              <div className="ob-field">
                <label className="ob-label" htmlFor="ob-account-name">Account name <span>*</span></label>
                <input
                  id="ob-account-name"
                  className="ob-input"
                  placeholder="Exactly as it appears on your bank account"
                  value={form.account_name}
                  onChange={e => update('account_name', e.target.value)}
                />
                <p className="ob-hint">
                  This should match the name on your school ID. We check this when you verify your identity.
                </p>
              </div>
            </>
          )}

          {/* ── Step 4: Legal Agreement ── */}
          {currentStep === 4 && (
            <>
              <h2 className="ob-card-title">Review & agree</h2>
              <p className="ob-card-sub">Please read and confirm each statement before submitting.</p>

              {[
                {
                  field: 'is_18' as keyof FormData,
                  text: 'I confirm that I am <strong>18 years or older</strong>, or that I have the consent of a parent or guardian to use this platform.',
                },
                {
                  field: 'items_genuine' as keyof FormData,
                  text: 'I confirm that all products I list on CampusMart are <strong>genuine, accurately described, and legally obtained</strong>. I will not list counterfeit, stolen, or prohibited items.',
                },
                {
                  field: 'agree_terms' as keyof FormData,
                  text: 'I have read and agree to <strong>CampusMart\'s Vendor Terms of Service</strong>, including the refund policy, dispute resolution process, and account suspension rules.',
                },
                {
                  field: 'agree_commission' as keyof FormData,
                  text: 'I understand that <strong>CampusMart charges a 5% commission</strong> on every completed sale. This is deducted automatically before my earnings are added to my wallet.',
                },
              ].map(({ field, text }) => (
                <label
                  key={field}
                  className={`ob-check-row${form[field] ? ' checked' : ''}`}
                >
                  <input type="checkbox" checked={Boolean(form[field])} onChange={e => update(field, e.target.checked)} />
                  <span
                    className="ob-check-label"
                    dangerouslySetInnerHTML={{ __html: text }}
                  />
                </label>
              ))}

              <div className="ob-field" style={{ marginTop: '20px' }}>
                <label className="ob-label" htmlFor="ob-signature">
                  Digital signature <span>*</span>
                </label>
                <input
                  id="ob-signature"
                  className="ob-input"
                  placeholder="Type your full legal name"
                  value={form.signature}
                  onChange={e => update('signature', e.target.value)}
                />
                <p className="ob-hint">
                  By typing your name, you confirm the statements above. <Link href="/terms">Read the marketplace terms</Link>.
                </p>
              </div>
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
