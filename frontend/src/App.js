import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Container } from 'react-bootstrap'; // Pour la mise en page
import Login from './components/Login';
import 'bootstrap/dist/css/bootstrap.min.css';
import Workflows from './components/Workflowss';
import Groupe from './components/Groupe';
import Doc from './components/Document';
import AdminUsers from './components/AdminUsers';
import ProtectedRoute from './ProtectedRoute'; // Importer le composant ProtectedRoute
import AssignedTasks from './components/AssignedTasks';
function App() {
  return (
    <Router>
      <Container className="mt-4">
        <Routes>
          {/* Route non protégée */}
          <Route path="/" element={<Login />} />
          {/* Routes protégées */}
          <Route path="/groupe" element={<ProtectedRoute element={<Groupe />} />} />
          <Route path="/AdminUsers" element={<ProtectedRoute element={<AdminUsers />} />} />
          <Route path="/document" element={<ProtectedRoute element={<Doc />} />} />
          <Route path="/workflows" element={<ProtectedRoute element={<Workflows />} />} />
          <Route path="/mes-taches" element={<ProtectedRoute element={<AssignedTasks />} />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;
