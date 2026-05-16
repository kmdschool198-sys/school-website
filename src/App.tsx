// Removed unused React import
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import ContentPage from './pages/ContentPage';
import CalendarPage from './pages/Calendar';
import Attendance from './pages/Attendance';
import Results from './pages/Results';
import TeacherLeave from './pages/TeacherLeave';
import TeacherTraining from './pages/TeacherTraining';
import ClubAttendance from './pages/ClubAttendance';
import TeacherHub from './pages/TeacherHub';
import TeacherLog from './pages/TeacherLog';
import MilkBrushReport from './pages/MilkBrushReport';
import ClassDashboard from './pages/ClassDashboard';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/results" element={<Results />} />
          <Route path="/teacher-leave" element={<TeacherLeave />} />
          <Route path="/teacher-training" element={<TeacherTraining />} />
          <Route path="/club-attendance" element={<ClubAttendance />} />
          <Route path="/teacher-hub" element={<TeacherHub />} />
          <Route path="/teacher-log/:type" element={<TeacherLog />} />
          <Route path="/milk-brush-report" element={<MilkBrushReport />} />
          <Route path="/class-dashboard" element={<ClassDashboard />} />
          <Route path="/page/:slug" element={<ContentPage />} />
          <Route path="/personnel/:slug" element={<ContentPage />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
