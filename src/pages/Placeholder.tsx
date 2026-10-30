import { Link } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { GlowCard } from '../components/GlowCard'

export function Placeholder({ title, phase, text }: { title: string; phase: string; text: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <GlowCard className="max-w-2xl">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF6A2C]/15 text-[#FF6A2C]">
          <Construction className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="font-display mt-5 text-3xl font-bold">{title}</h1>
        <p className="mt-2 inline-flex rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-[#94A3B8]">
          {phase}
        </p>
        <p className="mt-4 leading-relaxed text-[#94A3B8]">{text}</p>
        <Link
          to="/"
          className="bg-gradient-brand mt-6 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to Home
        </Link>
      </GlowCard>
    </section>
  )
}
