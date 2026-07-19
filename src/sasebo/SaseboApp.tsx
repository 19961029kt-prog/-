import { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Grain, ScrollProgressBar, Header, Footer } from './ui';
import HomePage from './pages/HomePage';
import StoryDetailPage from './pages/StoryDetailPage';
import ChallengersPage from './pages/ChallengersPage';

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);

  return null;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/story/:slug" element={<StoryDetailPage />} />
      <Route path="/challengers" element={<ChallengersPage />} />
    </Routes>
  );
}

export default function SaseboApp() {
  return (
    <HashRouter>
      <div className="min-h-screen w-full bg-navy-950 font-display">
        <Grain />
        <ScrollProgressBar />
        <Header />
        <ScrollToTop />
        <AppRoutes />
        <Footer />
      </div>
    </HashRouter>
  );
}
