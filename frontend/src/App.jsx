import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Results from './pages/Results';

// Route table. More pages (Login, History, etc.) get added here as later
// weeks' tasks are built out.
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/results" element={<Results />} />
    </Routes>
  );
}

export default App;
