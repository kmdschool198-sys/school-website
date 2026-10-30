// Removed unused React import
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import ContentPage from './pages/ContentPage';
import CalendarPage from './pages/Calendar';
import Attendance from './pages/Attendance';
import Results from './pages/Results';
import Privacy from './pages/Privacy';
import ClubAttendance from './pages/ClubAttendance';
import TeacherHub from './pages/TeacherHub';
import MilkReport from './pages/MilkReport';
import MonthlyFormPrint from './pages/MonthlyFormPrint';
import BodyMetricsPrint from './pages/BodyMetricsPrint';
import ClubPrint from './pages/ClubPrint';
import BodyMetricsGrid from './pages/BodyMetricsGrid';
import SavingGrid from './pages/SavingGrid';
import ManageClubs from './pages/ManageClubs';
import ManageRoster from './pages/ManageRoster';
import BrushLog from './pages/BrushLog';
import ClassDashboard from './pages/ClassDashboard';
import Homeroom from './pages/Homeroom';
import HomeroomPrint from './pages/HomeroomPrint';
import SchoolStatsReport from './pages/SchoolStatsReport';
import SchoolCalendar from './pages/SchoolCalendar';
import PorPor6Page from './pages/PorPor6Page';
import AcademicSummaryPage from './pages/AcademicSummaryPage';
import PorPor5Page from './pages/PorPor5Page';
import PrintHubPage from './pages/PrintHubPage';
import BehaviorPage from './pages/BehaviorPage';
import LunchPage from './pages/LunchPage';
import DutyPage from './pages/DutyPage';
import TimetablePage from './pages/TimetablePage';
import NotFound from './pages/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import PrivacyConsentBanner from './components/PrivacyConsentBanner';
import GlobalToast from './components/GlobalToast';
import ScrollReveal from './components/ScrollReveal';
import ScrollProgress from './components/ScrollProgress';
import RouteTitle from './components/RouteTitle';
import { SchoolDataProvider } from './context/SchoolDataContext';

function App() {
  return (
    <ErrorBoundary>
      <SchoolDataProvider>
        <Router>
          <RouteTitle />
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
          <Route path="/page/:slug" element={<ContentPage />} />
          <Route path="/personnel/:slug" element={<ContentPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
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
