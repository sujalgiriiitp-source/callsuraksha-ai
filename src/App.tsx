import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppHeader } from './components/layout/AppHeader'
import { Disclaimer } from './components/layout/Disclaimer'
import { MobileNav } from './components/layout/MobileNav'
import { Analyze } from './pages/Analyze'
import { Compare } from './pages/Compare'
import { Demo } from './pages/Demo'
import { Home } from './pages/Home'
import { Placeholder } from './pages/Placeholder'
import { Results } from './pages/Results'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-[#050D1C] pb-16 text-[#F8FAFC] md:pb-0">
        <AppHeader />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/results" element={<Results />} />
            <Route
              path="/guidance"
              element={
                <Placeholder
                  title="AI Voice Guidance"
                  phase="Phase 7 — Results dashboard me live hai"
                  text="Voice guidance ka alag page nahi hai — kisi call ko analyze karo, phir uske Results page par Gnani Timbre ki Hindi/Hinglish guidance suno."
                />
              }
            />
            <Route path="/compare" element={<Compare />} />
            <Route path="/demo" element={<Demo />} />
            <Route
              path="/how-it-works"
              element={
                <Placeholder
                  title="How It Works"
                  phase="Phase 2 ke baad detail page banega"
                  text="Pipeline: Upload/Record, Prisma transcript, risk indicators, safety guidance, Timbre voice guidance. Home page par 5-step strip abhi live hai."
                />
              }
            />
            <Route
              path="/about"
              element={
                <Placeholder
                  title="About CallSuraksha AI"
                  phase="About page — baad me poora hoga"
                  text="CallSuraksha AI Gnani AI — The Great Indian AI Internship Challenge 2026 ke liye banaya ja raha hai. Ye recorded calls par risk-flag analysis karta hai — live interception, caller identification, deepfake detection ya auto-reporting nahi karta."
                />
              }
            />
            <Route
              path="*"
              element={
                <Placeholder
                  title="Page nahi mila"
                  phase="404"
                  text="Ye route exist nahi karta. Home par wapas jao."
                />
              }
            />
          </Routes>
        </main>
        <Disclaimer />
        <MobileNav />
      </div>
    </BrowserRouter>
  )
}
