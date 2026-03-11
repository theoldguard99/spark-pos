import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Store, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft,
  Loader2, User, CheckCircle2, Circle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import SegmentedControl from '../components/ui/SegmentedControl'

type Mode = 'login' | 'signup'

interface PasswordRule {
  label: string
  test: (pw: string) => boolean
}

const passwordRules: PasswordRule[] = [
  { label: 'At least 8 characters',      test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter (A-Z)',  test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter (a-z)',  test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number (0-9)',            test: (pw) => /[0-9]/.test(pw) },
  { label: 'One symbol (e.g. @#$!)',      test: (pw) => /[^A-Za-z0-9]/.test(pw) },
]

const loginCarouselFiles = [
  'pexels-apasaric-stock-image.jpg',
  'pexels-hngstrm-stock-image.jpg',
  'pexels-rachel-claire-stock-image.jpg',
  'pexels-reneterp-stock-image.jpg',
  'pexels-robin-stock-image.jpg',
  'pexels-violetta-ramonaite-stock-image.jpg',
]

function PasswordRuleItem({ label, met }: { label: string; met: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs transition-colors ${met ? 'text-emerald-600' : 'text-slate-400'}`}>
      {met
        ? <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
        : <Circle size={13} className="shrink-0" />
      }
      {label}
    </div>
  )
}

function InputField({
  label, icon: Icon, type = 'text', value, onChange,
  placeholder, autoComplete, children,
}: {
  label: string
  icon: React.ElementType
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  children?: React.ReactNode
}) {
  return (
    <div className="overflow-visible">
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="relative overflow-visible">
        <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full min-h-[2.75rem] leading-normal pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
        />
        {children}
      </div>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()
  const { showSuccess, showError } = useToast()

  const [mode, setMode] = useState<Mode>('login')

  const [loginEmailOrUsername, setLoginEmailOrUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [email, setEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [showSignupPw, setShowSignupPw] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [phone, setPhone] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  const [loading, setLoading]           = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [isSlideVisible, setIsSlideVisible] = useState(true)

  const carouselImages = useMemo(() => {
    if (!isSupabaseConfigured) return []

    return loginCarouselFiles
      .map((fileName) => supabase.storage.from('assets').getPublicUrl(fileName).data.publicUrl)
      .filter(Boolean)
  }, [])
  const sparkIconUrl = isSupabaseConfigured
    ? supabase.storage.from('assets').getPublicUrl('spark-icon.png').data.publicUrl
    : null

  const pwChecks = useMemo(() => passwordRules.map((r) => r.test(signupPassword)), [signupPassword])
  const allPwRulesMet = pwChecks.every(Boolean)

  useEffect(() => {
    if (carouselImages.length < 2) return

    let fadeTimeout: number | null = null
    const interval = window.setInterval(() => {
      setIsSlideVisible(false)
      fadeTimeout = window.setTimeout(() => {
        setActiveSlide((prev) => (prev + 1) % carouselImages.length)
        setIsSlideVisible(true)
      }, 450)
    }, 5000)

    return () => {
      window.clearInterval(interval)
      if (fadeTimeout) window.clearTimeout(fadeTimeout)
    }
  }, [carouselImages.length])

  function switchMode(next: Mode) {
    setMode(next)
  }

  function clearAllFields() {
    setLoginEmailOrUsername('')
    setLoginPassword('')
    setFirstName('')
    setLastName('')
    setStoreName('')
    setPhone('')
    setEmail('')
    setSignupPassword('')
    setConfirmPw('')
    setShowPw(false)
    setShowSignupPw(false)
    setShowConfirmPw(false)
  }

  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 10)
    setPhone(digits)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (mode === 'login') {
      if (!loginEmailOrUsername || !loginPassword) { showError('Please fill in all fields.'); return }
      setLoading(true)
      const loginId = loginEmailOrUsername.trim()
      const emailForAuth = loginId.includes('@') ? loginId : `${loginId}@pos.local`
      const { error } = await signInWithEmail(emailForAuth, loginPassword)
      if (error) showError(error)
      else navigate('/dashboard')
      setLoading(false)
      return
    }

    if (!firstName.trim() || !lastName.trim()) { showError('Please enter your first and last name.'); return }
    if (!storeName.trim())  { showError('Please enter your store name.'); return }
    if (!email)             { showError('Please enter your email address.'); return }
    if (phone.length < 10)  { showError('Please enter a valid 10-digit PH mobile number.'); return }
    if (!allPwRulesMet)     { showError('Password does not meet all requirements.'); return }
    if (signupPassword !== confirmPw) { showError('Passwords do not match.'); return }

    setLoading(true)
    const { error } = await signUpWithEmail(email, signupPassword, {
      first_name: firstName.trim(),
      last_name:  lastName.trim(),
      store_name: storeName.trim(),
      phone:      `+63${phone}`,
    })
    if (error) {
      showError(error)
    } else {
      const registeredEmail = email
      clearAllFields()
      setMode('login')
      showSuccess(`Email confirmation sent to ${registeredEmail}. Please verify your email, then log in.`)
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) { showError(error); setGoogleLoading(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className={`hidden lg:block lg:w-7/12 sticky top-0 h-screen overflow-hidden ${carouselImages.length ? 'bg-slate-900' : 'bg-indigo-600'}`}>
        {carouselImages.length > 0 && (
          <>
            <img
              src={carouselImages[activeSlide]}
              alt="Business background"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${isSlideVisible ? 'opacity-100' : 'opacity-0'}`}
            />
            <div className="absolute inset-0 bg-slate-900/50" />
          </>
        )}
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link to="/" className="inline-flex items-center gap-3">
            {sparkIconUrl ? (
              <img src={sparkIconUrl} alt="SPARK icon" className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 text-white font-semibold">
                S
              </div>
            )}
            <span className="font-bold text-white text-xl">SPARK</span>
          </Link>

          <div className="max-w-md text-white">
            <h2 className="text-4xl font-extrabold leading-tight mb-4">
              Your business,<br />always under control.
            </h2>
            <p className="text-indigo-100 text-base leading-relaxed max-w-sm">
              Manage orders, track inventory, and monitor your sales —
              all in one simple dashboard.
            </p>
            <div className="mt-10 space-y-3">
              {['Real-time sales dashboard', 'Inventory & low-stock alerts', 'Order management & history', 'Sales charts & reports'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-indigo-100 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {carouselImages.length > 1 && (
              <div className="flex items-center gap-1.5">
                {carouselImages.map((_, idx) => (
                  <span
                    key={`slide-dot-${idx}`}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === activeSlide ? 'w-5 bg-white' : 'w-1.5 bg-white/45'
                    }`}
                  />
                ))}
              </div>
            )}
            <p className="text-indigo-300 text-xs">© {new Date().getFullYear()} SPARK</p>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-5/12 bg-white overflow-x-hidden overflow-y-auto relative">
        <Link
          to="/"
          className="absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <ArrowLeft size={14} />
          Back to Home
        </Link>
        <div className="w-full min-h-screen flex items-center justify-center px-4 sm:px-6 py-10">
          <div className="w-full max-w-md min-w-0">
          <Link to="/" className="flex items-center gap-2.5 mb-6 lg:hidden shrink-0">
            {sparkIconUrl ? (
              <img src={sparkIconUrl} alt="SPARK icon" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white text-sm font-semibold">
                S
              </div>
            )}
            <span className="font-bold text-slate-800 text-lg">SPARK</span>
          </Link>

            <div className="bg-slate-100 rounded-xl p-1 mb-6 shrink-0">
              <SegmentedControl
                value={mode}
                onChange={switchMode}
                options={[
                  { value: 'login', label: 'Log In' },
                  { value: 'signup', label: 'Sign Up' },
                ]}
                className="gap-1"
                optionClassName="border-0"
                activeClassName="bg-white text-slate-800 shadow-sm"
                inactiveClassName="bg-transparent text-slate-500 hover:text-slate-700"
              />
            </div>

            <div className="overflow-hidden min-w-0 w-full py-1">
              <div
                className="flex transition-transform duration-300 ease-out"
                style={{
                  width: '200%',
                  transform: mode === 'signup' ? 'translateX(-50%)' : 'translateX(0)',
                }}
              >
                <div
                  className="shrink-0 w-1/2 transition-opacity duration-300 ease-out"
                  style={{ opacity: mode === 'login' ? 1 : 0 }}
                >
                  <div className={`pl-2 pr-2 ${mode !== 'login' ? 'pointer-events-none' : ''}`}>
                    <h1 className="text-2xl font-bold text-slate-800 mb-1">Welcome back</h1>
                    <p className="text-slate-500 text-sm mb-7">Sign in to access your dashboard.</p>

                    {!isSupabaseConfigured && (
                      <div className="flex items-start gap-2.5 p-3.5 mb-5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                        <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                        <p>Supabase is not connected. Add your credentials to <code className="font-mono text-xs bg-amber-100 px-1 rounded">.env</code> to enable auth.</p>
                      </div>
                    )}

                    <Button
                      type="button"
                      onClick={handleGoogle}
                      disabled={googleLoading}
                      variant="outline"
                      fullWidth
                      className="mb-5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    >
                      {googleLoading ? <Loader2 size={18} className="animate-spin text-slate-400" /> : (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
                        </svg>
                      )}
                      Continue with Google
                    </Button>

                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400">or continue with email</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <InputField label="Email or username" icon={Mail} type="text" value={loginEmailOrUsername} onChange={setLoginEmailOrUsername} placeholder="you@example.com or Xk9mAbEMDelaCruzJuan030326" autoComplete="username" />
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                        <div className="relative overflow-visible">
                          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            type={showPw ? 'text' : 'password'}
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            className="w-full min-h-[2.75rem] leading-normal pl-10 pr-11 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                          />
                          <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        loading={loading}
                        fullWidth
                        className="rounded-xl mt-2"
                      >
                        Log In
                      </Button>
                    </form>

                    <p className="text-center text-xs text-slate-400 mt-6">
                      Don&apos;t have an account?{' '}
                      <button type="button" onClick={() => switchMode('signup')} className="text-indigo-600 font-medium hover:underline">
                        Sign up
                      </button>
                    </p>
                  </div>
                </div>

                <div
                  className="shrink-0 w-1/2 transition-opacity duration-300 ease-out"
                  style={{ opacity: mode === 'signup' ? 1 : 0 }}
                >
                  <div className={`pl-2 pr-2 ${mode !== 'signup' ? 'pointer-events-none' : ''}`}>
                    <h1 className="text-2xl font-bold text-slate-800 mb-1">Create your account</h1>
                    <p className="text-slate-500 text-sm mb-7">Sign up to get started with SPARK.</p>

                    {!isSupabaseConfigured && (
                      <div className="flex items-start gap-2.5 p-3.5 mb-5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                        <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                        <p>Supabase is not connected. Add your credentials to <code className="font-mono text-xs bg-amber-100 px-1 rounded">.env</code> to enable auth.</p>
                      </div>
                    )}

                    <Button
                      type="button"
                      onClick={handleGoogle}
                      disabled={googleLoading}
                      variant="outline"
                      fullWidth
                      className="mb-5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    >
                      {googleLoading ? <Loader2 size={18} className="animate-spin text-slate-400" /> : (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
                        </svg>
                      )}
                      Continue with Google
                    </Button>

                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400">or continue with email</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <InputField label="First Name" icon={User} value={firstName} onChange={setFirstName} placeholder="Juan" autoComplete="given-name" />
                        <InputField label="Last Name" icon={User} value={lastName} onChange={setLastName} placeholder="dela Cruz" autoComplete="family-name" />
                      </div>
                      <InputField label="Store Name" icon={Store} value={storeName} onChange={setStoreName} placeholder="Aling Nena's Store" autoComplete="organization" />
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile Number</label>
                        <div className="flex">
                          <div className="flex items-center gap-1.5 px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-sm text-slate-600 font-medium whitespace-nowrap">🇵🇭 +63</div>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => formatPhone(e.target.value)}
                            placeholder="9XXXXXXXXX"
                            maxLength={10}
                            autoComplete="tel"
                            className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                          />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Enter 10-digit number starting with 9 (e.g. 9171234567)</p>
                      </div>
                      <InputField label="Email Address" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            type={showSignupPw ? 'text' : 'password'}
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            placeholder="Create a strong password"
                            autoComplete="new-password"
                            className="w-full pl-10 pr-11 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                          />
                          <button type="button" onClick={() => setShowSignupPw((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showSignupPw ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        {signupPassword.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            {passwordRules.map((rule, i) => (
                              <PasswordRuleItem key={rule.label} label={rule.label} met={pwChecks[i]} />
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            type={showConfirmPw ? 'text' : 'password'}
                            value={confirmPw}
                            onChange={(e) => setConfirmPw(e.target.value)}
                            placeholder="Re-enter your password"
                            autoComplete="new-password"
                            className={`w-full pl-10 pr-11 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-shadow ${
                              confirmPw.length > 0
                                ? signupPassword === confirmPw
                                  ? 'border-emerald-400 focus:ring-emerald-400'
                                  : 'border-red-400 focus:ring-red-400'
                                : 'border-slate-200 focus:ring-indigo-500'
                            }`}
                          />
                          <button type="button" onClick={() => setShowConfirmPw((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        {confirmPw.length > 0 && (
                          <p className={`text-xs mt-1.5 ${signupPassword === confirmPw ? 'text-emerald-600' : 'text-red-500'}`}>
                            {signupPassword === confirmPw ? '✓ Passwords match' : '✗ Passwords do not match'}
                          </p>
                        )}
                      </div>
                      <Button
                        type="submit"
                        loading={loading}
                        fullWidth
                        className="rounded-xl mt-2"
                      >
                        Create Account
                      </Button>
                    </form>

                    <p className="text-center text-xs text-slate-400 mt-6">
                      Already have an account?{' '}
                      <button type="button" onClick={() => switchMode('login')} className="text-indigo-600 font-medium hover:underline">
                        Log in
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
