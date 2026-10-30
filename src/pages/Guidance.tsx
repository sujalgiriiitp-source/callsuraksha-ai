/**
 * CallSuraksha AI — AI Voice Guidance page (Phase 9).
 *
 * Real guidance already lives inside the Results dashboard, so this page
 * is a meaningful standalone experience: it explains how the guidance is
 * made, which voices exist, and — when an analysis exists in this session —
 * renders the REAL VoiceGuidance card (no extra TTS call thanks to the
 * session cache). Without an analysis it offers real next steps instead
 * of a dead end.
 */
import { Link } from 'react-router-dom'
import { ArrowRight, AudioLines, Headphones, Info, ShieldAlert, Volume2 } from 'lucide-react'
import { GlowCard } from '../components/GlowCard'
import { VoiceGuidance } from '../components/VoiceGuidance'
import { getLastAnalysis } from '../lib/analysis'

export function Guidance() {
  const last = getLastAnalysis()

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8B5CF6]">
          AI Voice Guidance
        </p>
        <h1 className="font-display mt-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
          Safety guidance, <span className="text-gradient-brand">Hindi me suno.</span>
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-[#94A3B8]">
          Jab aap kisi call ko analyze karte ho, Gnani Timbre uske risk analysis se ek chhoti
          Hindi safety guidance bolkar sunata hai — risk kya hai, aur aage kya karna hai.
        </p>
      </section>

      {/* How it is made */}
      <section className="grid gap-4 md:grid-cols-3">
        <GlowCard>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3345E]/15 text-[#F3345E]">
            <ShieldAlert className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="font-display mt-4 font-semibold">1. Analysis se banti hai</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
            Script aapki call ke asli risk band aur top risk categories se banta hai — koi
            pre-written ya fake verdict nahi. Wording hamesha "risk lag rahi hai" hoti hai, kabhi
            "fraud hai" nahi.
          </p>
        </GlowCard>
        <GlowCard>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#8B5CF6]/15 text-[#8B5CF6]">
            <AudioLines className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="font-display mt-4 font-semibold">2. Do awaazein</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
            <strong className="text-[#F8FAFC]">Poorvi</strong> — Hinglish (hi-en), aur{' '}
            <strong className="text-[#F8FAFC]">Nalini</strong> — Hindi (hi-IN). Dono Gnani Timbre
            v2.5 se bolti hain. Voice badalne par guidance usi awaaz me dobara banti hai.
          </p>
        </GlowCard>
        <GlowCard>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#11CFA8]/15 text-[#11CFA8]">
            <Volume2 className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="font-display mt-4 font-semibold">3. Chhoti aur saaf</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
            Timbre dheere bolta hai (lagbhag 2 words per second), isliye guidance lagbhag 28
            second ki hoti hai. Poore safe steps Results page par hamesha dikhte hain. Agar audio
            nahi banta, to text guidance dikhti hai — dashboard kabhi nahi toot-ta.
          </p>
        </GlowCard>
      </section>

      {/* Live guidance (when an analysis exists) or next steps */}
      <section>
        {last ? (
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Aapki latest analysis ki guidance
            </h2>
            <p className="mt-2 text-[#94A3B8]">
              File: {last.fileName} · Risk band: {last.result.analysis.riskBand}
            </p>
            <div className="mt-6">
              <VoiceGuidance analysis={last.result.analysis} />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/results"
                className="bg-gradient-brand inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white"
              >
                Full Results dekho <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                to="/analyze"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold transition-colors hover:bg-white/10"
              >
                Nayi call analyze karo
              </Link>
            </div>
          </div>
        ) : (
          <GlowCard>
            <h2 className="font-display flex items-center gap-2 text-xl font-bold">
              <Info className="h-5 w-5 text-[#8B5CF6]" aria-hidden /> Abhi koi analysis nahi hai
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
              Voice guidance aapki call ke risk analysis se banti hai. Is session me abhi koi
              call analyze nahi hui hai — pehle ek call analyze karo ya demo sample try karo,
              phir uski asli Hindi guidance yahan sun payenge.
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
                <Headphones className="h-4 w-4" aria-hidden /> Demo Samples
              </Link>
            </div>
          </GlowCard>
        )}
      </section>
    </div>
  )
}
