import { Route, Routes } from 'react-router-dom';
import Lobby from './pages/Lobby';
import Call from './pages/Call';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Lobby />} />
      <Route path="/call" element={<Call />} />
    </Routes>
  );
}
