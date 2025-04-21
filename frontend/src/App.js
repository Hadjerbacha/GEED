import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Container } from 'react-bootstrap'; // Pour la mise en page
import Login from './components/Login';
import 'bootstrap/dist/css/bootstrap.min.css';
import Workflows from './components/Workflowss';
import Groupe from './components/Groupe';
import Doc from './components/Document';
import Document from './components/Doc';
import AdminUsers from './components/AdminUsers';
import ProtectedRoute from './ProtectedRoute'; // Importer le composant ProtectedRoute
import AssignedTasks from './components/AssignedTasks';
import Details from './components/Details';
import Register from './components/Register';
import Folder from './components/Folder';
function App() {
  return (
    <Router>
     <Container fluid style={{ minHeight: '100vh' }} className="g-0">
        <Routes>
          {/* Route non protégée */}
          <Route path="/" element={<Login />} />
          {/* Routes protégées */}
          <Route path="/groupe" element={<ProtectedRoute element={<Groupe />} />} />
          <Route path="/AdminUsers" element={<ProtectedRoute element={<AdminUsers />} />} />
          <Route path="/document" element={<ProtectedRoute element={<Doc />} />} />
          <Route path="/documents" element={<ProtectedRoute element={<Document />} />} />
          <Route path="/folder" element={<ProtectedRoute element={<Folder/>} />} />      
          <Route path="/workflows" element={<ProtectedRoute element={<Workflows />} />} />
          <Route path="/mes-taches" element={<ProtectedRoute element={<AssignedTasks />} />} />
          <Route path="/details/:id" element={<ProtectedRoute element={<Details />} />} />
          <Route path="/register" element={<ProtectedRoute element={<Register />} />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;
