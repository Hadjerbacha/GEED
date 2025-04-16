import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Container } from 'react-bootstrap'; // Pour la mise en page
import Login from './components/Login';
import 'bootstrap/dist/css/bootstrap.min.css';
import Workflows from './components/Workflowss';
import Register from './components/Register';
import Doc from './components/Document';
import Task from './components/Tasks';
import ProtectedRoute from './ProtectedRoute'; // Importer le composant ProtectedRoute

function App() {
  return (
    <Router>
      <Container className="mt-4">
        <Routes>
          {/* Route non protégée */}
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Routes protégées */}
          <Route path="/document" element={<ProtectedRoute element={<Doc />} />} />
          <Route path="/workflows" element={<ProtectedRoute element={<Workflows />} />} />
          <Route path="/tasks" element={<ProtectedRoute element={<Task />} />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;
