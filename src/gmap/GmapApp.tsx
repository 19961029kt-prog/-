import { HashRouter, Route, Routes } from 'react-router-dom';
import { ProgressProvider } from './progress';
import { Dashboard } from './pages/Dashboard';
import { SubjectPage } from './pages/SubjectPage';
import { UnitPage } from './pages/UnitPage';
import { QuizPage } from './pages/QuizPage';
import { ReviewPage } from './pages/ReviewPage';
import { MockExamPage } from './pages/MockExamPage';

function GmapApp() {
  return (
    <ProgressProvider>
      <HashRouter>
        <div className="min-h-screen bg-slate-50">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/s/:subject" element={<SubjectPage />} />
            <Route path="/s/:subject/quiz" element={<QuizPage />} />
            <Route path="/s/:subject/u/:topicNumber" element={<UnitPage />} />
            <Route path="/s/:subject/u/:topicNumber/quiz" element={<QuizPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/mock" element={<MockExamPage />} />
          </Routes>
        </div>
      </HashRouter>
    </ProgressProvider>
  );
}

export default GmapApp;
