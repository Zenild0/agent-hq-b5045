import { Navigate, Route, Routes } from 'react-router-dom';
import Admin from './pages/Admin';
import Captain from './pages/Captain';
import Home from './pages/Home';
import Host from './pages/Host';
import Join from './pages/Join';
import Live from './pages/Live';
import NewEvent from './pages/NewEvent';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/new" element={<NewEvent />} />
      <Route path="/join" element={<Join />} />
      <Route path="/join/:code" element={<Join />} />
      <Route path="/e/:code" element={<Navigate to="live" replace />} />
      <Route path="/e/:code/live" element={<Live />} />
      <Route path="/e/:code/board" element={<Live forceBoard />} />
      <Route path="/e/:code/captain" element={<Captain />} />
      <Route path="/e/:code/host" element={<Host />} />
      <Route path="/e/:code/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
