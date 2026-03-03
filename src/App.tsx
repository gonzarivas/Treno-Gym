import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import History from './pages/History';
import RoutineBuilder from './pages/RoutineBuilder';
import Stats from './pages/Stats';
import ExerciseDetail from './pages/ExerciseDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="historial" element={<History />} />
          <Route path="routine" element={<RoutineBuilder />} />
          <Route path="stats" element={<Stats />} />
          <Route path="exercise/:id" element={<ExerciseDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
