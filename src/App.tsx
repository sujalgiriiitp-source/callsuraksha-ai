import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppHeader } from './components/layout/AppHeader'
import { Disclaimer } from './components/layout/Disclaimer'
import { MobileNav } from './components/layout/MobileNav'
import { Analyze } from './pages/Analyze'
import { Home } from './pages/Home'
import { Placeholder } from './pages/Placeholder'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-[#050D1C] pb-16 text-[#F8FAFC] md:pb-0">
        <AppHeader />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route
              path="/results"
              element={
                <Placeholder
                  title="Analysis Results"
                  phase="Phase 6 me banega"
                  text="Yahan transcript highlights, risk band aur safety guidance dikhega. Koi bhi result abhi pre-generated ya fake nahi hai — ye page tabhi bharega jab real analysis chalega."
                />
              }
            />
            <Route
              path="/guidance"
              element={
                <Placeholder
                  title="AI Voice Guidance"
                  phase="Phase 7 me banega"
                  text="Yahan Gnani Timbre ki Hindi/Hinglish voice guidance sunne ko milegi. Timbre abhi connected nahi hai."
                />
              }
            />
            <Route
              path="/compare"
              element={
                <Placeholder
                  title="Clean vs Noisy Comparison"
                  phase="Phase 8 me banega"
                  text="Yahan ek hi synthetic call ka clean aur noisy version side-by-side compare hoga, taaki Prisma ka noisy-audio performance dikh sake."
                />
              }
            />
            <Route
              path="/demo"
              element={
                <Placeholder
                  title="Demo Samples"
                  phase="Phase 8 me banega"
                  text="Yahan synthetic demo samples aayenge — audio Phase 8 me Timbre se generate hoga. Abhi koi audio, transcript ya duration yahan nahi hai."
                />
              }
            />
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
