import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

// Composants
import Login from './components/Login';
import Workflows from './components/Workflowss';
import Register from './components/Register';
import Doc from './components/Document';

// ✅ Composant route protégée
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" />;
};

function App() {
  return (
    <Router>
      <Container className="mt-4">
        <Routes>
          {/* 🔓 Pages accessibles sans connexion */}
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* 🔒 Pages protégées */}
          <Route 
            path="/document" 
            element={
              <ProtectedRoute>
                <Doc />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/workflows" 
            element={
              <ProtectedRoute>
                <Workflows />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;
