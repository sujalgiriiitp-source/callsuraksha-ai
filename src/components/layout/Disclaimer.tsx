import { AlertTriangle } from 'lucide-react'

export function Disclaimer() {
  return (
    <div className="border-t border-white/10 bg-[#0A1830]/60">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-5 text-sm text-[#94A3B8] sm:px-6">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6A2C]" aria-hidden />
        <p>
          CallSuraksha AI gives <strong className="text-[#F8FAFC]">risk indicators</strong> for
          recorded calls — never a fraud verdict. It does not intercept or block live calls,
          identify callers, or report to police or banks. Use synthetic or consented recordings
          only. If a call asks for an OTP, PIN, or payment, stop and call the bank yourself on
          its official number. Report suspected fraud on 1930.
        </p>
      </div>
    </div>
  )
}
