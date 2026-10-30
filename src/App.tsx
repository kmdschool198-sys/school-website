import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import PrivacyConsentBanner from './components/PrivacyConsentBanner';
import GlobalToast from './components/GlobalToast';
import ScrollReveal from './components/ScrollReveal';
import ScrollProgress from './components/ScrollProgress';
import RouteTitle from './components/RouteTitle';
import { SchoolDataProvider } from './context/SchoolDataContext';

// Only the home page ships in the first bundle; every other page loads when visited
const Admin = lazy(() => import('./pages/Admin'));
const ContentPage = lazy(() => import('./pages/ContentPage'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Results = lazy(() => import('./pages/Results'));
const Privacy = lazy(() => import('./pages/Privacy'));
const ClubAttendance = lazy(() => import('./pages/ClubAttendance'));
const TeacherHub = lazy(() => import('./pages/TeacherHub'));
const MilkReport = lazy(() => import('./pages/MilkReport'));
const MonthlyFormPrint = lazy(() => import('./pages/MonthlyFormPrint'));
const BodyMetricsPrint = lazy(() => import('./pages/BodyMetricsPrint'));
const ClubPrint = lazy(() => import('./pages/ClubPrint'));
const BodyMetricsGrid = lazy(() => import('./pages/BodyMetricsGrid'));
const SavingGrid = lazy(() => import('./pages/SavingGrid'));
const ManageClubs = lazy(() => import('./pages/ManageClubs'));
const ManageRoster = lazy(() => import('./pages/ManageRoster'));
const BrushLog = lazy(() => import('./pages/BrushLog'));
const ClassDashboard = lazy(() => import('./pages/ClassDashboard'));
const Homeroom = lazy(() => import('./pages/Homeroom'));
const HomeroomPrint = lazy(() => import('./pages/HomeroomPrint'));
const SchoolStatsReport = lazy(() => import('./pages/SchoolStatsReport'));
const SchoolCalendar = lazy(() => import('./pages/SchoolCalendar'));
const PorPor6Page = lazy(() => import('./pages/PorPor6Page'));
const AcademicSummaryPage = lazy(() => import('./pages/AcademicSummaryPage'));
const PorPor5Page = lazy(() => import('./pages/PorPor5Page'));
const PrintHubPage = lazy(() => import('./pages/PrintHubPage'));
const BehaviorPage = lazy(() => import('./pages/BehaviorPage'));
const LunchPage = lazy(() => import('./pages/LunchPage'));
const DutyPage = lazy(() => import('./pages/DutyPage'));
const TimetablePage = lazy(() => import('./pages/TimetablePage'));
const JanitorTaskPage = lazy(() => import('./pages/JanitorTaskPage'));
const JanitorDutyPage = lazy(() => import('./pages/JanitorDutyPage'));
const HomeVisitPage = lazy(() => import('./pages/HomeVisitPage'));

function App() {
  return (
    <ErrorBoundary>
      <SchoolDataProvider>
        <Router>
          <RouteTitle />
          <Suspense fallback={<div style={{ minHeight: '60vh' }} aria-busy="true" />}>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/results" element={<Results />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/club-attendance" element={<ClubAttendance />} />
          <Route path="/teacher-hub" element={<TeacherHub />} />
          <Route path="/milk-report" element={<MilkReport />} />
          <Route path="/print-form/:type" element={<MonthlyFormPrint />} />
          <Route path="/body-metrics" element={<BodyMetricsGrid />} />
          <Route path="/saving" element={<SavingGrid />} />
          <Route path="/print-body-metrics" element={<BodyMetricsPrint />} />
          <Route path="/print-club" element={<ClubPrint />} />
          <Route path="/manage-clubs" element={<ManageClubs />} />
          <Route path="/manage-roster" element={<ManageRoster />} />
          <Route path="/brush-log" element={<BrushLog />} />
          {/* Backward compat */}
          <Route path="/milk-brush-report" element={<MilkReport />} />
          <Route path="/class-dashboard" element={<ClassDashboard />} />
          <Route path="/homeroom" element={<Homeroom />} />
          <Route path="/print-homeroom" element={<HomeroomPrint />} />
          <Route path="/school-stats-report" element={<SchoolStatsReport />} />
          <Route path="/school-calendar" element={<SchoolCalendar />} />
          <Route path="/porpor6" element={<PorPor6Page />} />
          <Route path="/academic-summary" element={<AcademicSummaryPage />} />
          <Route path="/porpor5" element={<PorPor5Page />} />
          <Route path="/print-hub" element={<PrintHubPage />} />
          <Route path="/behavior" element={<BehaviorPage />} />
          <Route path="/lunch" element={<LunchPage />} />
          <Route path="/duty" element={<DutyPage />} />
          <Route path="/lunch-duty" element={<LunchPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/janitor-tasks" element={<JanitorTaskPage />} />
          <Route path="/janitor-duty" element={<JanitorDutyPage />} />
          <Route path="/home-visit" element={<HomeVisitPage />} />
          <Route path="/page/:slug" element={<ContentPage />} />
          <Route path="/personnel/:slug" element={<ContentPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
          </Suspense>
        <PrivacyConsentBanner />
        <GlobalToast />
        <ScrollReveal />
        <ScrollProgress />
      </Router>
      </SchoolDataProvider>
    </ErrorBoundary>
  );
}

export default App;
