/**
 * CallSuraksha AI — How It Works page (Phase 9).
 *
 * Follows the uploaded How It Works reference (image-11.png): 5-step
 * process, "Inside the Analysis" pattern cards, privacy panel, CTA
 * banner. Deliberately NOT copied from the reference: "High accuracy
 * transcription", "fraud detection" wording, "Built with enterprise-grade
 * security", and a fake "Play Sample Guidance" button. The guidance card
 * here renders the REAL VoiceGuidance component when an analysis exists
 * in this session — otherwise it links to the Demo page.
 */
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  AudioLines,
  Check,
  FileText,
  Headphones,
  Lock,
  Mic,
  PhoneCall,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Upload,
  Volume2,
  Zap,
} from 'lucide-react'
import { GlowCard } from '../components/GlowCard'
import { VoiceGuidance } from '../components/VoiceGuidance'
import { getLastAnalysis } from '../lib/analysis'

const STEPS = [
  {
    n: '1',
    icon: Upload,
    color: '#377BFF',
    title: 'Upload or Record',
    text: 'Upload a recorded call or record directly from your device. You can also try our demo samples.',
    badge: 'WAV, MP3, OGG, FLAC, AAC, M4A · max 5 MB / 30 sec',
  },
  {
    n: '2',
    icon: AudioLines,
    color: '#8B5CF6',
    title: 'Speech to Text',
    text: 'Gnani Prisma converts the audio into text in Hindi, Hinglish or English.',
    badge: 'Prisma v3.0 · tested on noisy telephonic audio',
  },
  {
    n: '3',
    icon: Search,
    color: '#FF6A2C',
    title: 'Risk Analysis',
    text: 'The rule engine reads the transcript and flags risky patterns like impersonation, OTP requests and urgency pressure — with reasons.',
    badge: '8 risk categories · rule-based, explainable',
  },
  {
    n: '4',
    icon: FileText,
    color: '#11CFA8',
    title: 'Explainable Results',
    text: 'You get a clear summary with highlighted risky parts, a qualitative risk band and simple explanations.',
    badge: 'Low / Medium / High / Unable to Assess — a flag, not a verdict',
  },
  {
    n: '5',
    icon: Volume2,
    color: '#F3345E',
    title: 'Voice Guidance',
    text: 'Listen to AI-generated safety guidance in Hindi to understand the risks and what to do next.',
    badge: 'Gnani Timbre v2.5 · Poorvi (Hinglish) / Nalini (Hindi)',
  },
]

const PATTERNS = [
  {
    icon: ShieldAlert,
    color: '#F3345E',
    title: 'Impersonation',
    text: 'Claims to be from a bank, government or well-known company.',
  },
  {
    icon: PhoneCall,
    color: '#FF6A2C',
    title: 'Account Threat',
    text: 'Says your account will be blocked or suspended.',
  },
  {
    icon: Shield,
    color: '#8B5CF6',
    title: 'OTP & Sensitive Info',
    text: 'Asks for OTP, PIN or personal details.',
  },
  {
    icon: Zap,
    color: '#377BFF',
    title: 'Urgency Pressure',
    text: 'Tries to create immediate action with fear or rewards.',
  },
]

const LIMITATIONS = [
  'The risk engine is rule-based — a new scam script that matches none of its 8 patterns can score Low. Low never means guaranteed safe.',
  'Prisma can mis-hear words, and a transcript can be partial — if the transcript is short or unclear, the result is "Unable to Assess", not "safe".',
  'Prisma gives no word timestamps, no per-word confidence and no speaker labels — highlights are matched on the transcript text only.',
  'Only recorded audio up to 30 seconds / 5 MB is supported. Live calls are never intercepted, blocked or monitored.',
  'The system never identifies the caller, never detects deepfakes and never auto-reports to police or banks.',
  'Timbre speaks slowly (about 2 words per second), so spoken guidance is kept short — the full safe steps stay visible on the Results page.',
]

export function HowItWorks() {
  const last = getLastAnalysis()

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
      {/* Hero */}
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#FF6A2C]/40 bg-[#FF6A2C]/10 px-3 py-1 text-xs font-semibold text-[#FF6A2C]">
            <Zap className="h-3.5 w-3.5" aria-hidden /> HOW IT WORKS
          </p>
          <h1 className="font-display mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
            How <span className="text-gradient-brand">CallSuraksha AI</span> Works
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#94A3B8]">
            From your audio recording to clear safety guidance — powered by Gnani AI. A simple,
            secure process to flag suspicious calls and help you stay safe.
          </p>
        </div>
        <GlowCard>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3345E]/15 text-[#F3345E]">
              <Shield className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display font-semibold">Powered by Gnani AI</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#94A3B8]">
                Speech-to-text and Hindi voice guidance, built for real-world Indian calls in
                Hindi, Hinglish and English — Prisma v3.0 for transcription, Timbre v2.5 for
                spoken safety guidance.
              </p>
            </div>
          </div>
        </GlowCard>
      </section>

      {/* Step-by-step process */}
      <section>
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Step-by-Step Process</h2>
        <p className="mt-2 text-[#94A3B8]">
          See how CallSuraksha AI analyzes your call and gives you safety guidance.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, i) => (
            <div key={step.n} className="relative">
              <GlowCard className="h-full">
                <span className="bg-gradient-brand flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white">
                  {step.n}
                </span>
                <span
                  className="mt-4 flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${step.color}22`, color: step.color }}
                >
                  <step.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="font-display mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{step.text}</p>
                <p className="mt-4 inline-flex rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-[#94A3B8]">
                  {step.badge}
                </p>
              </GlowCard>
              {i < STEPS.length - 1 && (
                <ArrowRight
                  className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-[#377BFF] lg:block"
                  aria-hidden
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Inside the analysis */}
      <section>
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Inside the Analysis</h2>
        <p className="mt-2 text-[#94A3B8]">
          CallSuraksha AI looks for common risk patterns and provides clear explanations.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PATTERNS.map((pattern) => (
            <GlowCard key={pattern.title}>
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${pattern.color}22`, color: pattern.color }}
              >
                <pattern.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="font-display mt-4 font-semibold">{pattern.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{pattern.text}</p>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* Guidance + privacy — grid items need min-w-0 so their min-content
          never forces the single-column track wider than the viewport
          (Phase 6: HowItWorks overflow at 320/375px when guidance is ready). */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <GlowCard className="min-w-0">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#11CFA8]/15 text-[#11CFA8]">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display font-semibold">AI Safety Guidance (Hindi)</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#94A3B8]">
                Get simple, easy-to-understand advice in Hindi on what to do and what not to do,
                based on the detected risks.
              </p>
            </div>
          </div>
          <div className="mt-5">
            {last ? (
              <VoiceGuidance analysis={last.result.analysis} transcribeRequestId={last.result.request_id} />
            ) : (
              <p className="text-sm leading-relaxed text-[#94A3B8]">
                Voice guidance aapki call ke risk analysis se banti hai. Pehle koi call analyze
                karo ya demo sample try karo — phir yahan uski asli Hindi guidance sun payenge.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10"
              >
                <Headphones className="h-4 w-4" aria-hidden /> Demo sample try karo
              </Link>
              <Link
                to="/analyze"
                className="bg-gradient-brand inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
              >
                Analyze a Call <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </GlowCard>

        <GlowCard className="min-w-0 border-[#377BFF]/30">
          <h2 className="font-display flex items-center gap-2 font-semibold">
            <Lock className="h-5 w-5 text-[#377BFF]" aria-hidden /> Your Privacy is Our Priority
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
            Your audio is processed in memory and not stored. We respect your privacy.
          </p>
          <ul className="mt-4 space-y-2.5 text-sm text-[#94A3B8]">
            {[
              'Audio processed in memory — no file is saved on the server',
              'No permanent storage of recordings or transcripts',
              'Gnani API key stays server-side only, never in the browser',
              'Synthetic or consented recordings only — no real third-party calls',
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#11CFA8]" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </GlowCard>
      </section>

      {/* Honest limitations */}
      <section>
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Technical limitations — honestly</h2>
        <p className="mt-2 text-[#94A3B8]">
          Ye system kya nahi kar sakta, ye jaanna utna hi zaroori hai jitna ye jaanna ki ye kya
          karta hai.
        </p>
        <GlowCard className="mt-8">
          <ul className="space-y-3 text-sm leading-relaxed text-[#94A3B8]">
            {LIMITATIONS.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Mic className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6A2C]" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </GlowCard>
      </section>

      {/* CTA banner */}
      <section className="bg-gradient-brand rounded-2xl px-6 py-8 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display flex items-center gap-2 text-2xl font-bold text-white">
              <Shield className="h-6 w-6" aria-hidden /> Try CallSuraksha AI Now
            </h2>
            <p className="mt-1 text-sm text-white/85">
              Upload a recorded call or try a sample to see how it works.
            </p>
          </div>
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 rounded-xl bg-[#050D1C] px-5 py-3 font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            Analyze a Call <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  )
}
