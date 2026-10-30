import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  FileAudio,
  Mic,
  PlayCircle,
  ShieldCheck,
  Volume2,
  X,
} from 'lucide-react'
import { GlowCard } from '../components/GlowCard'

const STEPS = [
  {
    n: '1',
    title: 'Upload / Record',
    text: 'Recorded call upload karo, ya mic se record karo — synthetic ya consented recording hi.',
  },
  {
    n: '2',
    title: 'Prisma transcript',
    text: 'Gnani Prisma noisy Hinglish / Hindi call ko text me badalta hai.',
  },
  {
    n: '3',
    title: 'Risk indicators',
    text: 'Rule engine risky lines ko reason ke saath highlight karta hai.',
  },
  {
    n: '4',
    title: 'Safety guidance',
    text: 'Safe steps dikhte hain — OTP kabhi share mat karo, bank ko khud call karo.',
  },
  {
    n: '5',
    title: 'Timbre voice guidance',
    text: 'Gnani Timbre Hindi me safety verdict aur safe steps bolkar sunata hai.',
  },
]

const DOES = [
  'Recorded calls analyze karta hai — upload, mic recording, ya demo sample se',
  'Risky lines ko reason ke saath highlight karta hai',
  'Risk band deta hai: Low / Medium / High / Unable to Assess — ek flag, verdict nahi',
  'Safe steps batata hai: OTP kabhi share mat karo, bank ko khud uske official number par call karo, 1930 par report karo',
]

const DOES_NOT = [
  'Live calls intercept ya block nahi karta',
  'Caller ko identify nahi karta',
  'Deepfake detection nahi karta',
  'Police ya bank ko auto-report nahi karta',
]

const DEMO_SAMPLES = [
  {
    title: 'OTP pressure call',
    kind: 'High-risk pattern',
    note: 'Synthetic demo — Phase 8 me audio aayega.',
  },
  {
    title: 'Bank advisory call',
    kind: 'Safe call — awareness',
    note: 'Synthetic demo — Phase 8 me audio aayega.',
  },
  {
    title: 'Noisy telephonic call',
    kind: 'Clean vs noisy comparison',
    note: 'Synthetic demo — Phase 8 me audio aayega.',
  },
]

export function Home() {
  return (
    <div className="space-y-16 pb-8 sm:space-y-20">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 sm:pt-20">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#377BFF]">
          AI for a safer India
        </p>
        <h1 className="font-display mt-4 max-w-3xl text-5xl font-extrabold leading-tight sm:text-7xl">
          Call Suno, <span className="text-gradient-brand">Risk Samjho.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-[#94A3B8]">
          Recorded Hindi, Hinglish aur English phone calls ko samjho — Gnani Prisma transcript,
          explainable risk indicators, aur Hindi safety guidance ke saath.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/analyze"
            className="bg-gradient-brand inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-lg shadow-[#F3345E]/25 transition-transform hover:scale-[1.03]"
          >
            Analyze a Call <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            to="/demo"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#101D35]/60 px-6 py-3 font-semibold text-[#F8FAFC] transition-colors hover:bg-white/10"
          >
            <PlayCircle className="h-4 w-4" aria-hidden /> Try a Demo
          </Link>
        </div>
        <div className="glass-card mt-10 inline-flex items-center gap-3 px-4 py-3 text-sm">
          <ShieldCheck className="h-4 w-4 text-[#11CFA8]" aria-hidden />
          <span className="text-[#94A3B8]">System status:</span>
          <span className="font-medium text-[#F8FAFC]">Server online · Gnani key not set</span>
        </div>
        <p className="mt-4 max-w-xl text-sm text-[#94A3B8]">
          Recorded audio analysis — live call interception nahi. Gnani integration abhi
          connected nahi hai; API key set hote hi real transcription shuru hogi.
        </p>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">How it works</h2>
            <p className="mt-2 text-[#94A3B8]">Recorded call se safety guidance tak — paanch steps.</p>
          </div>
          <Link
            to="/how-it-works"
            className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-[#FF6A2C] hover:underline sm:inline-flex"
          >
            Full explainer <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step) => (
            <Link key={step.n} to="/how-it-works">
              <GlowCard className="h-full transition-colors hover:border-[#FF6A2C]/50">
                <span className="bg-gradient-brand flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white">
                  {step.n}
                </span>
                <h3 className="font-display mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{step.text}</p>
              </GlowCard>
            </Link>
          ))}
        </div>
      </section>

      {/* Does / does not */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Kya karta hai — aur kya nahi</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <GlowCard>
            <h3 className="font-display flex items-center gap-2 font-semibold text-[#11CFA8]">
              <Check className="h-5 w-5" aria-hidden /> What it does
            </h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#94A3B8]">
              {DOES.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#11CFA8]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </GlowCard>
          <GlowCard>
            <h3 className="font-display flex items-center gap-2 font-semibold text-[#F3345E]">
              <X className="h-5 w-5" aria-hidden /> What it does NOT do
            </h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#94A3B8]">
              {DOES_NOT.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-[#F3345E]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-[#94A3B8]">
              Result hamesha ek <strong className="text-[#F8FAFC]">risk flag</strong> hota hai —
              kabhi fraud verdict nahi.
            </p>
          </GlowCard>
        </div>
      </section>

      {/* Demo samples teaser */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Demo samples</h2>
            <p className="mt-2 text-[#94A3B8]">
              Synthetic demo only — real call recordings yahan nahi dikhayi jati.
            </p>
          </div>
          <Link
            to="/demo"
            className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-[#FF6A2C] hover:underline sm:inline-flex"
          >
            All samples <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {DEMO_SAMPLES.map((sample) => (
            <Link key={sample.title} to="/demo">
              <GlowCard className="h-full transition-colors hover:border-[#8B5CF6]/50">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#8B5CF6]/15 text-[#8B5CF6]">
                  {sample.title.includes('Noisy') ? (
                    <Volume2 className="h-5 w-5" aria-hidden />
                  ) : (
                    <Mic className="h-5 w-5" aria-hidden />
                  )}
                </span>
                <h3 className="font-display mt-4 font-semibold">{sample.title}</h3>
                <p className="mt-1 text-sm text-[#94A3B8]">{sample.kind}</p>
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-[#94A3B8]">
                  <FileAudio className="h-3.5 w-3.5" aria-hidden /> {sample.note}
                </p>
              </GlowCard>
            </Link>
          ))}
        </div>
      </section>

      {/* Safety + privacy */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <GlowCard className="border-[#11CFA8]/25">
          <h2 className="font-display flex items-center gap-2 text-xl font-bold">
            <ShieldCheck className="h-5 w-5 text-[#11CFA8]" aria-hidden /> Safety &amp; privacy
          </h2>
          <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-[#94A3B8] sm:grid-cols-3">
            <li>
              <strong className="text-[#F8FAFC]">Synthetic data only.</strong> Demo me sirf
              synthetic ya consented recordings use hoti hain.
            </li>
            <li>
              <strong className="text-[#F8FAFC]">Audio not stored.</strong> Upload kiya gaya
              audio analysis ke baad store nahi kiya jata.
            </li>
            <li>
              <strong className="text-[#F8FAFC]">API key server-side only.</strong> Gnani key
              kabhi browser code ya chat me nahi aati.
            </li>
          </ul>
        </GlowCard>
      </section>
    </div>
  )
}
