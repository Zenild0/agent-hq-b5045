import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getPlatformInfo } from './lib/api';
import Admin from './pages/Admin';
import Captain from './pages/Captain';
import Dev from './pages/Dev';
import Home from './pages/Home';
import Host from './pages/Host';
import Join from './pages/Join';
import Live from './pages/Live';
import NewEvent from './pages/NewEvent';
import Terms from './pages/Terms';

/** A thin ribbon on a test copy of the app, so it can never be mistaken for the real site. */
function TestRibbon() {
  const [test, setTest] = useState(false);
  useEffect(() => {
    getPlatformInfo().then((i) => setTest(i.env === 'test')).catch(() => {});
  }, []);
  if (!test) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[95] bg-[#7c3aed] py-1 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-[#fff]" role="note">
      Test copy — practise here · nothing on this site is real
    </div>
  );
}

export default function App() {
  return (
    <>
      <TestRibbon />
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/new" element={<NewEvent />} />
      <Route path="/join" element={<Join />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/dev" element={<Dev />} />
      <Route path="/join/:code" element={<Join />} />
      <Route path="/e/:code" element={<Navigate to="live" replace />} />
      <Route path="/e/:code/live" element={<Live />} />
      <Route path="/e/:code/board" element={<Live forceBoard />} />
      <Route path="/e/:code/captain" element={<Captain />} />
      <Route path="/e/:code/host" element={<Host />} />
      <Route path="/e/:code/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
