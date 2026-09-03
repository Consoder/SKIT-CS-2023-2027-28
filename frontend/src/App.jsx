import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';

// Route table. More pages (Login, Analysis Results Dashboard, etc.) get
// added here as later weeks' tasks are built out.
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}

export default App;
