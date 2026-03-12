import { useNavigate } from 'react-router-dom'
import {
  Store,
  BarChart3,
  ShoppingCart,
  Package,
  ArrowRight,
  CheckCircle2,
  Zap,
  Shield,
  LogIn,
  TrendingUp,
  Smartphone,
  Receipt,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const sellingPoints = [
  {
    icon: TrendingUp,
    title: 'Built for starting SMEs',
    description: 'From sari-sari stores to small restaurants — get a full POS without enterprise prices or long contracts.',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    icon: Receipt,
    title: 'Orders, inventory & reports',
    description: 'Ring up sales, track stock, and see daily revenue in one place. No spreadsheets, no guesswork.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Smartphone,
    title: 'Use any device',
    description: 'Desktop, tablet, or phone — works in the browser. No extra hardware or installation required.',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
]

const highlights = [
  'From ₱100 per month — affordable for new businesses',
  'Real-time dashboard and sales reports',
  'Cloud sync — access your data from anywhere',
  'Quick setup — go live in minutes, not days',
]

const faqs = [
  {
    q: 'Can I use SPARK on mobile and tablet?',
    a: 'Yes. SPARK is web-based, so it works on desktop, tablet, and mobile browsers.',
  },
  {
    q: 'Does SPARK support multiple staff in one store?',
    a: 'Yes. You can add employees and assign roles from Settings.',
  },
  {
    q: 'What happens if my coupon expires?',
    a: 'Expired coupons stay in your records for history but can no longer be applied to new orders.',
  },
]

const annualBasePrice = 1188
const annualDiscountRate = 0.1
const annualDiscountedPrice = annualBasePrice * (1 - annualDiscountRate)

export default function Landing() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const isLoggedIn = isSupabaseConfigured ? !!session : false
  const logoUrl = isSupabaseConfigured ? supabase.storage.from('assets').getPublicUrl('spark-logo-2.png').data.publicUrl : null

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt="SPARK" className="h-11 w-auto object-contain" />
          ) : (
            <>
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600">
                <Store size={18} className="text-white" />
              </div>
              <span className="font-bold text-slate-800 text-lg">SPARK</span>
            </>
          )}
        </div>
        <nav className="hidden md:flex items-center gap-5 text-sm">
          <button onClick={() => document.getElementById('selling-points')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-600 hover:text-slate-900">
            Features
          </button>
          <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-600 hover:text-slate-900">
            Pricing
          </button>
          <div className="relative group">
            <button className="text-slate-600 hover:text-slate-900">Subscription</button>
            <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-3 w-[32rem] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 opacity-0 shadow-xl transition-all duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Monthly Plan</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">Monthly Subscription</h3>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">
                    ₱99
                    <span className="ml-1 text-sm font-medium text-slate-500">/month</span>
                  </p>
                  <p className="mt-2 text-xs font-medium text-indigo-700">PHP Pesos Offer</p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Premium Annual</p>
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">10% OFF</span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">Premium Annual Subscription</h3>
                  <p className="mt-2 flex items-end gap-2">
                    <span className="text-2xl font-extrabold text-slate-900">₱{annualDiscountedPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-sm font-medium text-slate-500">/year</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="line-through">₱{annualBasePrice.toLocaleString()}</span> base price
                  </p>
                </div>
              </div>
            </div>
          </div>
          <button onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-600 hover:text-slate-900">
            FAQ
          </button>
        </nav>
        {isLoggedIn ? (
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Go to Dashboard
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <LogIn size={16} />
            Login
          </button>
        )}
      </header>

      <section className="flex flex-col items-center text-center px-6 pt-16 pb-20 sm:pt-20 sm:pb-24 bg-gradient-to-b from-slate-50 via-white to-white">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full mb-6 border border-indigo-100">
          <Zap size={12} />
          Sales Point Access, Register & Kiosk
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight max-w-3xl mb-4">
          POS for your growing business.{' '}
          <span className="text-indigo-600">From ₱100/month.</span>
        </h1>

        <p className="text-lg text-slate-600 max-w-xl mb-10 leading-relaxed">
          SPARK gives small and micro businesses a complete point-of-sale system — orders, inventory, and reports — without the big price tag. Start selling smarter today.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {isLoggedIn ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-base transition-all hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98]"
            >
              Open Dashboard
              <ArrowRight size={18} />
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-base transition-all hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98]"
            >
              <LogIn size={18} />
              Get started
            </button>
          )}
          <button
            onClick={() => document.getElementById('selling-points')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-3.5 text-slate-600 hover:text-slate-800 font-medium rounded-xl border border-slate-200 hover:border-slate-300 transition-colors text-base"
          >
            See why SPARK
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
          {[
            { k: '₱100', v: 'Starting monthly price' },
            { k: '15 min', v: 'Typical setup time' },
            { k: 'Web-based', v: 'No app install required' },
          ].map((item) => (
            <div key={item.v} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left">
              <p className="text-sm font-bold text-slate-800">{item.k}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-indigo-600 py-8 sm:py-10 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center text-white">
          <div>
            <p className="text-3xl sm:text-4xl font-extrabold">From ₱100</p>
            <p className="text-indigo-200 text-sm mt-1">per month</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold">For SMEs</p>
            <p className="text-indigo-200 text-sm mt-1">sari-sari, retail, food</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold">No install</p>
            <p className="text-indigo-200 text-sm mt-1">works in your browser</p>
          </div>
        </div>
      </section>

      <section id="selling-points" className="py-16 sm:py-20 px-6 max-w-5xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-3">Why small businesses choose SPARK</h2>
          <p className="text-slate-500 text-base max-w-lg mx-auto">
            A full POS without the cost or complexity. Built for owners who want to focus on selling, not on software.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {sellingPoints.map(({ icon: Icon, title, description, color, bg }) => (
            <div
              key={title}
              className="p-6 sm:p-7 rounded-2xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/50 transition-all"
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${bg} mb-4`}>
                <Icon size={24} className={color} />
              </div>
              <h3 className="font-semibold text-slate-800 text-lg mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 sm:py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-3">Everything you need in one place</h2>
            <p className="text-slate-500 text-base max-w-lg mx-auto">
              Dashboard, orders, products, and reports — no extra modules or hidden fees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: BarChart3, title: 'Real-time dashboard', desc: 'Today’s sales, revenue, and low-stock alerts at a glance.', color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { icon: ShoppingCart, title: 'Order management', desc: 'Ring up orders, track status, and print or send receipts.', color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { icon: Package, title: 'Products & inventory', desc: 'Manage items, SKU, price, stock, and categories.', color: 'text-violet-600', bg: 'bg-violet-50' },
            ].map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="flex gap-4 p-5 rounded-xl bg-white border border-slate-100">
                <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${bg}`}>
                  <Icon size={20} className={color} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">{title}</h3>
                  <p className="text-sm text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-8">Simple, affordable, ready to go</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            {highlights.map((item) => (
              <div key={item} className="flex items-start gap-3 bg-slate-50 rounded-xl px-5 py-4 border border-slate-100">
                <CheckCircle2 size={20} className="text-emerald-500 mt-0.5 shrink-0" />
                <span className="text-slate-700 font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-16 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-3">Simple pricing for growing stores</h2>
            <p className="text-slate-500">Start lean, then scale as your business grows.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-indigo-700">Starter</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">₱100<span className="text-base font-medium text-slate-500">/month</span></p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>Orders, products, and checkout</li>
                <li>Daily sales dashboard</li>
                <li>Basic reporting</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">Growth</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">Custom</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>Everything in Starter</li>
                <li>Advanced promo/coupon workflows</li>
                <li>Multi-role team operations</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">Frequently asked questions</h2>
          <div className="space-y-3">
            {faqs.map((item) => (
              <details key={item.q} className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">{item.q}</summary>
                <p className="mt-2 text-sm text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gradient-to-b from-slate-50 to-white text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-6">
          <Shield size={28} className="text-white" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-3">Start your business on the right foot</h2>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">
          Join SMEs using SPARK to run their POS for as low as ₱100/month. No long-term lock-in, no surprise fees.
        </p>
        {isLoggedIn ? (
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-base transition-all hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98]"
          >
            Go to Dashboard
            <ArrowRight size={18} />
          </button>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-base transition-all hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98]"
          >
            <LogIn size={18} />
            Get started — from ₱100/month
          </button>
        )}
      </section>

      <footer className="py-6 px-6 border-t border-slate-100 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} SPARK — Sales Point Access, Register & Kiosk. Built for SMEs.
      </footer>
    </div>
  )
}
