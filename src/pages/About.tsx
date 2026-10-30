/**
 * CallSuraksha AI — About page (Phase 9).
 *
 * No reference image exists for About, so this page is built from the
 * Phase 9 spec: objective, problem, architecture, Gnani integration,
 * privacy safeguards, responsible-AI limitations and the synthetic
 * demonstration methodology. Every claim is about what the app actually
 * does — no fake scores, no enterprise-grade claims, no fraud verdicts.
 */
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  AudioLines,
  FlaskConical,
  Lock,
  Mic,
  PhoneCall,
  Scale,
  Server,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Volume2,
} from 'lucide-react'
import { GlowCard } from '../components/GlowCard'

const ARCHITECTURE = [
  {
    icon: Smartphone,
    color: '#377BFF',
    title: 'Frontend — React + TypeScript',
    text: 'Upload, mic recording, demo samples, results dashboard, voice guidance and comparison — sab isi app me. Audio aur transcript sirf browser memory me rehte hain.',
  },
  {
    icon: Server,
    color: '#FF6A2C',
    title: 'Backend — Node + Express',
    text: 'API key server-side only rehti hai. File size (5 MB) aur duration (30 sec) yahin validate hote hain; audio memory me hi rehta hai, disk par kabhi save nahi hota.',
  },
  {
    icon: AudioLines,
    color: '#8B5CF6',
    title: 'Gnani Prisma v3.0 — Speech to Text',
    text: 'Noisy Hinglish / Hindi call audio ko transcript me badalta hai. Language hi-IN,en-IN, format transcribe. Word timestamps ya per-word confidence API nahi deta.',
  },
  {
    icon: ShieldAlert,
    color: '#F3345E',
    title: 'Risk Analysis Engine — rule-based',
    text: 'Transcript ko sentence-by-sentence padhta hai: OTP demand, account-block threat, impersonation, urgency pressure, payment pressure, personal details — negation ko samajhta hai (safety warning scam nahi hai).',
  },
  {
    icon: Volume2,
    color: '#11CFA8',
    title: 'Gnani Timbre v2.5 — Voice Guidance',
    text: 'Risk analysis se bana Hindi safety script Poorvi (Hinglish) ya Nalini (Hindi) ki awaaz me bolta hai. Raw PCM ko server WAV me convert karta hai.',
  },
]

const PRIVACY = [
  'Synthetic ya consented recordings only — kisi teesre vyakti ki call bina consent ke record ya upload mat karo.',
  'Upload kiya gaya audio server memory me hi rehta hai — disk par save nahi hota, database nahi hai.',
  'Transcript aur result sirf aapke browser ki memory me rehte hain — refresh karte hi clear ho jate hain.',
  'Gnani API key kabhi browser bundle, chat ya GitHub me nahi aati — sirf server ke paas rehti hai.',
  'Demo me koi real phone number, account number, Aadhaar ya PAN nahi dikhaya jata.',
]

const LIMITATIONS = [
  'Result hamesha ek risk flag hai — Low / Medium / High / Unable to Assess. Ye kabhi fraud verdict nahi hai.',
  'Engine rule-based hai — naye scam script jisme koi pattern na mile, Low score kar sakta hai. Low ka matlab safe ki guarantee nahi hai.',
  'Transcript adhura ya galat sunna ja sakta hai — isliye kam evidence par result "Unable to Assess" hota hai, "safe" nahi.',
  'Live calls intercept, block ya monitor nahi karta. Caller identify nahi karta. Deepfake detection nahi karta. Police ya bank ko auto-report nahi karta.',
]

export function About() {
  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
      {/* Hero */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#377BFF]">
          About CallSuraksha AI
        </p>
        <h1 className="font-display mt-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
          Call Suno, <span className="text-gradient-brand">Risk Samjho.</span>
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-[#94A3B8]">
          CallSuraksha AI recorded phone calls ko analyze karke risk indicators dikhata hai —
          taaki aap OTP, bank ya KYC ke naam par hone wale pressure ko pehchan sako, aur sahi
          kadam utha sako.
        </p>
      </section>

      {/* Objective + problem */}
      <section className="grid gap-4 md:grid-cols-2">
        <GlowCard>
          <h2 className="font-display flex items-center gap-2 text-xl font-bold">
            <PhoneCall className="h-5 w-5 text-[#F3345E]" aria-hidden /> Problem
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
            India me scam calls aksar Hindi ya Hinglish me aati hain — bank executive, KYC
            update, UPI payment ya lottery ke naam par. Caller pressure banata hai: "abhi OTP
            batao, varna account band ho jayega." Aise me ek aam user ko turant samajh nahi aata
            ki call me kya risky hai, aur kya karna chahiye.
          </p>
        </GlowCard>
        <GlowCard>
          <h2 className="font-display flex items-center gap-2 text-xl font-bold">
            <ShieldCheck className="h-5 w-5 text-[#11CFA8]" aria-hidden /> Objective
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
            Ek recorded call ko upload karo — app uska transcript banata hai, risky lines ko
            reason ke saath highlight karta hai, ek qualitative risk band deta hai, aur Hindi me
            safety guidance sunata hai: OTP kabhi share mat karo, bank ko khud uske official
            number par call karo, 1930 par report karo.
          </p>
        </GlowCard>
      </section>

      {/* Architecture */}
      <section>
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Technology architecture</h2>
        <p className="mt-2 text-[#94A3B8]">
          Ek hi codebase — frontend, secure backend, Gnani AI models aur ek explainable rule
          engine.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ARCHITECTURE.map((item) => (
            <GlowCard key={item.title} className="h-full">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${item.color}22`, color: item.color }}
              >
                <item.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="font-display mt-4 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{item.text}</p>
            </GlowCard>
          ))}
          <GlowCard className="border-[#FF6A2C]/30">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF6A2C]/15 text-[#FF6A2C]">
              <FlaskConical className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="font-display mt-4 font-semibold">Clean vs Noisy Comparison</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
              Wahi call saaf aur 12 dB SNR noisy audio me — dono par alag-alag real Prisma calls,
              aur WER / CER / Important Phrase Recall se measured comparison. Demo page par dekho.
            </p>
            <Link
              to="/compare"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#FF6A2C] hover:underline"
            >
              Compare dekho <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </GlowCard>
        </div>
      </section>

      {/* Privacy + limitations */}
      <section className="grid gap-4 md:grid-cols-2">
        <GlowCard className="border-[#377BFF]/30">
          <h2 className="font-display flex items-center gap-2 text-xl font-bold">
            <Lock className="h-5 w-5 text-[#377BFF]" aria-hidden /> Privacy safeguards
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#94A3B8]">
            {PRIVACY.map((item) => (
              <li key={item} className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#11CFA8]" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </GlowCard>
        <GlowCard className="border-[#F3345E]/30">
          <h2 className="font-display flex items-center gap-2 text-xl font-bold">
            <Scale className="h-5 w-5 text-[#F3345E]" aria-hidden /> Responsible AI — limitations
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#94A3B8]">
            {LIMITATIONS.map((item) => (
              <li key={item} className="flex gap-2.5">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#F3345E]" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </GlowCard>
      </section>

      {/* Synthetic methodology */}
      <section>
        <h2 className="font-display text-2xl font-bold sm:text-3xl">
          Synthetic demonstration methodology
        </h2>
        <p className="mt-2 max-w-3xl text-[#94A3B8]">
          Demo me koi real call recording nahi hai. Saare samples Gnani Timbre se generate kiye
          gaye synthetic audio hain — scripted scenarios (bank OTP, UPI payment, KYC pressure,
          customer care, OTP safety advisory, normal information). Noisy version me seeded white
          noise add karke measured SNR 12.01 dB banaya gaya hai. Comparison metrics (WER, CER,
          phrase recall) reference script ke against calculate kiye jate hain — ye demonstration
          measurements hain, benchmark claim nahi.
        </p>
        <GlowCard className="mt-8">
          <h3 className="font-display flex items-center gap-2 font-semibold">
            <Mic className="h-5 w-5 text-[#8B5CF6]" aria-hidden /> Built for the Gnani AI
            Challenge
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
            CallSuraksha AI Gnani AI — The Great Indian AI Internship Challenge 2026 ke liye
            banaya gaya hai. Built by Sujal Giri (B.Tech CSE, SIET / AKTU; B.S. Computer Science
            and Data Analytics, IIT Patna). Submission deadline: 10 Nov 2026.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/analyze"
              className="bg-gradient-brand inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white"
            >
              Analyze a Call <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold transition-colors hover:bg-white/10"
            >
              Demo Samples
            </Link>
          </div>
        </GlowCard>
      </section>
    </div>
  )
}
