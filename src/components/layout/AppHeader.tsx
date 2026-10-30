import { Link, NavLink } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/analyze', label: 'Analyze' },
  { to: '/demo', label: 'Demo' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/about', label: 'About' },
]

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="bg-gradient-brand flex h-9 w-9 items-center justify-center rounded-xl">
        <ShieldCheck className="h-5 w-5 text-white" aria-hidden />
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-[#F8FAFC]">
        CallSuraksha <span className="text-gradient-brand">AI</span>
      </span>
    </Link>
  )
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050D1C]/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/10 text-[#F8FAFC]'
                    : 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F8FAFC]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link
          to="/analyze"
          className="bg-gradient-brand hidden rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#F3345E]/25 transition-transform hover:scale-[1.03] sm:inline-flex"
        >
          Analyze a Call
        </Link>
      </div>
    </header>
  )
}
