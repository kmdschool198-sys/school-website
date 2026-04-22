// Removed unused React import
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import ContentPage from './pages/ContentPage';
import CalendarPage from './pages/Calendar';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/page/:slug" element={<ContentPage />} />
        <Route path="/personnel/:slug" element={<ContentPage />} />
      </Routes>
    </Router>
  );
}

export default App;
