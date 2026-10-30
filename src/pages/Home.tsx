import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Gift,
  Landmark,
  Play,
  PlayCircle,
  Shield,
  ShieldCheck,
  Volume2,
  X,
  Zap,
  Users,
  AlertTriangle,
  Headphones,
  FileText,
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

const FEATURES = [
  {
    icon: FileText,
    color: '#377BFF',
    title: 'AI Transcription',
    text: 'Hindi / Hinglish / English call recordings ka transcript, Gnani Prisma se.',
    badge: 'Hindi · Hinglish · English',
  },
  {
    icon: ShieldCheck,
    color: '#F3345E',
    title: 'Risk-flag Analysis',
    text: 'Risky patterns aur urgency tactics ko reason ke saath highlight karta hai.',
    badge: 'Recorded audio analysis',
  },
  {
    icon: Volume2,
    color: '#8B5CF6',
    title: 'Hindi Voice Guidance',
    text: 'Safety verdict aur safe steps Hindi me suno — Gnani Timbre se.',
    badge: 'Hindi safety guidance',
  },
  {
    icon: Headphones,
    color: '#11CFA8',
    title: 'Works in Noisy Audio',
    text: 'Real-world telephonic recordings ke liye bana — background noise ke saath bhi.',
    badge: 'Noisy telephonic audio',
  },
]

const TRUST_BADGES = [
  { icon: ShieldCheck, label: 'Private & Secure' },
  { icon: Zap, label: 'Hindi & Hinglish Support' },
  { icon: Users, label: 'Built for a Safer India' },
]

const SCAM_BUBBLES = [
  { icon: Landmark, label: 'Fake Bank Call?' },
  { icon: Gift, label: 'Lottery Scam?' },
  { icon: Users, label: 'KYC Fraud?' },
]

// Synthetic preview — script lines only, no invented scores or timings beyond the script itself.
const PREVIEW_TRANSCRIPT = [
  { who: 'Caller', line: 'Namaste, main aapke bank se bol raha hoon.' },
  { who: 'Caller', line: 'Aapka account block ho gaya hai.' },
  { who: 'Caller', line: 'Kyc verify karne ke liye abhi OTP bataiye.' },
  { who: 'You', line: 'Kya yeh sahi hai?' },
  { who: 'Caller', line: 'Agar abhi nahi bataya toh account permanent band ho jayega.' },
]

const PREVIEW_INDICATORS = [
  { n: '1', text: 'Asks for OTP (banks never ask for OTP on a call)' },
  { n: '2', text: 'Creates urgency and fear' },
  { n: '3', text: 'Claims account will be blocked' },
  { n: '4', text: 'Impersonates a bank representative' },
]

const DEMO_SAMPLES = [
  {
    title: 'Bank OTP Scam',
    kind: 'Fake bank executive asking for OTP',
    risk: 'High Risk',
    riskClass: 'bg-[#F3345E]/15 text-[#F3345E]',
    icon: Landmark,
  },
  {
    title: 'Lottery Fraud',
    kind: 'You won a prize, pay processing fee',
    risk: 'High Risk',
    riskClass: 'bg-[#F3345E]/15 text-[#F3345E]',
    icon: Gift,
  },
  {
    title: 'KYC Verification Scam',
    kind: 'Asking for Aadhaar / PAN details',
    risk: 'Medium Risk',
    riskClass: 'bg-[#FF6A2C]/15 text-[#FF6A2C]',
    icon: Users,
  },
]

const WAVE_BARS = [10, 18, 26, 14, 30, 22, 34, 16, 28, 12, 24, 32, 18, 26, 14, 30, 20, 34, 12, 26, 18, 28, 16, 24, 10, 30, 22, 14, 28, 18]

function Waveform({ className = '' }: { className?: string }) {
  return (
    <div className={`flex h-10 items-center gap-[3px] ${className}`} aria-hidden>
      {WAVE_BARS.map((h, i) => (
        <span
          key={i}
          style={{ height: `${h}px` }}
          className={`w-[3px] rounded-full ${i % 3 === 0 ? 'bg-[#F3345E]' : 'bg-[#FF6A2C]'}`}
        />
      ))}
    </div>
  )
}

export function Home() {
  const [previewNote, setPreviewNote] = useState(false)
  const [playingSample, setPlayingSample] = useState<string | null>(null)

  return (
    <div className="space-y-12 pb-8 sm:space-y-16">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#377BFF]">
              AI for a safer India
            </p>
            <h1 className="font-display mt-4 text-5xl font-extrabold leading-tight sm:text-7xl">
              Call Suno, <span className="text-gradient-brand">Risk Samjho.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-[#94A3B8]">
              Recorded Hindi, Hinglish aur English phone calls ko samjho — Gnani Prisma
              transcript, explainable risk indicators, aur Hindi safety guidance ke saath.
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
                <PlayCircle className="h-4 w-4" aria-hidden /> Watch Demo
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-[#94A3B8]">
              {TRUST_BADGES.map((badge) => (
                <li key={badge.label} className="flex items-center gap-2">
                  <badge.icon className="h-4 w-4 text-[#FF6A2C]" aria-hidden />
                  {badge.label}
                </li>
              ))}
            </ul>
            <div className="glass-card mt-8 inline-flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <ShieldCheck className="h-4 w-4 text-[#11CFA8]" aria-hidden />
              <span className="text-[#94A3B8]">System status:</span>
              <span className="font-medium text-[#F8FAFC]">Server online · Gnani key not set</span>
            </div>
            <p className="mt-4 max-w-xl text-sm text-[#94A3B8]">
              Recorded audio analysis — live call interception nahi. Gnani integration abhi
              connected nahi hai; API key set hote hi real transcription shuru hogi.
            </p>
          </div>

          {/* Hero visual — CSS/SVG composition, no fake phone number or photo */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
            <div className="pointer-events-none absolute -inset-8 rounded-full bg-[#F3345E]/15 blur-3xl" />
            <div className="glass-card relative overflow-hidden p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Unknown Number</p>
                  <p className="mt-0.5 text-xs text-[#94A3B8]">Synthetic demo call · no real number</p>
                </div>
                <span className="rounded-full bg-[#F3345E]/15 px-2.5 py-1 text-xs font-semibold text-[#F3345E]">
                  Suspicious pattern
                </span>
              </div>
              <div className="mt-6 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-full bg-[#F3345E]/20 blur-xl" />
                  <span className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[#F3345E]/40 bg-[#F3345E]/10">
                    <Shield className="h-11 w-11 text-[#F3345E]" />
                  </span>
                </div>
              </div>
              <Waveform className="mt-6 justify-center" />
              <div className="mt-4 flex items-center justify-center gap-3">
                <Link
                  to="/analyze"
                  className="rounded-full bg-[#11CFA8]/15 px-3.5 py-1.5 text-xs font-semibold text-[#11CFA8]"
                >
                  Analyze
                </Link>
                <Link
                  to="/how-it-works"
                  className="rounded-full bg-[#FF6A2C]/15 px-3.5 py-1.5 text-xs font-semibold text-[#FF6A2C]"
                >
                  Detect Risk
                </Link>
                <Link
                  to="/guidance"
                  className="rounded-full bg-[#8B5CF6]/15 px-3.5 py-1.5 text-xs font-semibold text-[#8B5CF6]"
                >
                  Get Guidance
                </Link>
              </div>
            </div>
            <ul className="relative mt-4 space-y-2">
              {SCAM_BUBBLES.map((bubble) => (
                <li
                  key={bubble.label}
                  className="glass-card flex w-fit items-center gap-2 px-3.5 py-2 text-sm font-medium"
                >
                  <bubble.icon className="h-4 w-4 text-[#F3345E]" />
                  {bubble.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <GlowCard key={feature.title} className="h-full">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${feature.color}22`, color: feature.color }}
              >
                <feature.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="font-display mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{feature.text}</p>
              <p className="mt-4 inline-flex rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-[#94A3B8]">
                {feature.badge}
              </p>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* Sample Analysis Preview — synthetic, labelled, no scores */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Sample Analysis Preview</h2>
            <p className="mt-2 text-[#94A3B8]">
              Ek synthetic demo call ka preview — ye pre-written sample hai, live analysis nahi.
            </p>
          </div>
          <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#94A3B8]">
            This is a sample result
          </span>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <GlowCard>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setPreviewNote((v) => !v)}
                aria-label="Sample audio preview"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F8FAFC] text-[#050D1C] transition-transform hover:scale-105"
              >
                <Play className="h-5 w-5" aria-hidden />
              </button>
              <Waveform className="flex-1" />
              <span className="text-sm font-medium text-[#94A3B8]">Synthetic sample</span>
            </div>
            {previewNote && (
              <p className="mt-3 text-sm text-[#94A3B8]" role="status">
                Sample audio Phase 8 me aayega — abhi sirf script dikhaya gaya hai.
              </p>
            )}
            <h3 className="font-display mt-6 font-semibold">Transcript (Hindi / Hinglish)</h3>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed">
              {PREVIEW_TRANSCRIPT.map((line, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-14 shrink-0 font-semibold text-[#94A3B8]">{line.who}:</span>
                  <span>{line.line}</span>
                </li>
              ))}
            </ul>
          </GlowCard>
          <GlowCard className="border-[#F3345E]/30">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3345E]/15 text-[#F3345E]">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="font-display text-xl font-bold text-[#F3345E]">High Risk</h3>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-[#94A3B8]">
                Risk band only — no score
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
              This call shows multiple signs of a potential fraud attempt.
            </p>
            <h4 className="font-display mt-5 font-semibold">Detected Indicators</h4>
            <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-[#94A3B8]">
              {PREVIEW_INDICATORS.map((item) => (
                <li key={item.n} className="flex gap-3">
                  <span className="bg-gradient-brand flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                    {item.n}
                  </span>
                  {item.text}
                </li>
              ))}
            </ol>
          </GlowCard>
        </div>
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

      {/* Demo samples */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Try Demo Samples</h2>
            <p className="mt-2 text-[#94A3B8]">
              Synthetic demo only — real call recordings yahan nahi dikhayi jati.
            </p>
          </div>
          <Link
            to="/demo"
            className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-[#FF6A2C] hover:underline sm:inline-flex"
          >
            View all samples <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {DEMO_SAMPLES.map((sample) => (
            <GlowCard key={sample.title} className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3345E]/15 text-[#F3345E]">
                  <sample.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sample.riskClass}`}>
                  {sample.risk}
                </span>
              </div>
              <h3 className="font-display mt-4 font-semibold">{sample.title}</h3>
              <p className="mt-1 flex-1 text-sm text-[#94A3B8]">{sample.kind}</p>
              <p className="mt-2 text-xs text-[#94A3B8]">Synthetic sample · audio ≤ 28 sec</p>
              <button
                type="button"
                onClick={() =>
                  setPlayingSample((cur) => (cur === sample.title ? null : sample.title))
                }
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10"
              >
                <Play className="h-4 w-4" aria-hidden /> Play Sample
              </button>
              {playingSample === sample.title && (
                <p className="mt-3 text-sm text-[#94A3B8]" role="status">
                  Sample audio Phase 8 me aayega — abhi sirf script aur risk band dikhaya gaya hai.
                </p>
              )}
            </GlowCard>
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
