import { NavLink } from 'react-router-dom'
import { FileAudio, FlaskConical, Home, Info, ListOrdered } from 'lucide-react'

const ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/analyze', label: 'Analyze', icon: FileAudio },
  { to: '/demo', label: 'Demo', icon: FlaskConical },
  { to: '/how-it-works', label: 'How It Works', icon: ListOrdered },
  { to: '/about', label: 'About', icon: Info },
]

export function MobileNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0A1830]/95 backdrop-blur md:hidden"
      aria-label="Mobile"
    >
      <div className="grid grid-cols-5">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? 'text-[#FF6A2C]' : 'text-[#94A3B8]'
              }`
            }
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
