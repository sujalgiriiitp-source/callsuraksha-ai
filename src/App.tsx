import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppHeader } from './components/layout/AppHeader'
import { Disclaimer } from './components/layout/Disclaimer'
import { MobileNav } from './components/layout/MobileNav'
import { Analyze } from './pages/Analyze'
import { About } from './pages/About'
import { Compare } from './pages/Compare'
import { Demo } from './pages/Demo'
import { Guidance } from './pages/Guidance'
import { Home } from './pages/Home'
import { HowItWorks } from './pages/HowItWorks'
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
            <Route path="/guidance" element={<Guidance />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/about" element={<About />} />
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
