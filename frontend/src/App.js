import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Container } from 'react-bootstrap'; // Pour la mise en page
import Login from './components/Login';
import 'bootstrap/dist/css/bootstrap.min.css';
import Workflows from './components/Workflowss';
import Workflow from './components/Workflow';
import Groupe from './components/Groupe';
import Doc from './components/Document';
import Document from './components/Doc';
import AdminUsers from './components/AdminUsers';
import ProtectedRoute from './ProtectedRoute'; // Importer le composant ProtectedRoute
import AssignedTasks from './components/AssignedTasks';
import Details from './components/Details';
import DetailsTache from './components/DetailsTasks';
import DetailsWorkflow from './components/WorkflowDetails';
import Accueil from './components/Accueil';
import Register from './components/Register';
import Folder from './components/Folder';
import DocumentDetails from './components/DocumentDetails';

function App() {
  return (
    <Router>
     <Container fluid style={{ minHeight: '100vh' }} className="g-0">
        <Routes>
          {/* Route non protégée */}
          <Route path="/" element={<Login />} />
          {/* Routes protégées */}
          <Route path="/accueil" element={<ProtectedRoute element={<Accueil />} />} />
          <Route path="/groupe" element={<ProtectedRoute element={<Groupe />} />} />
          <Route path="/AdminUsers" element={<ProtectedRoute element={<AdminUsers />} />} />
          <Route path="/document" element={<ProtectedRoute element={<Doc />} />} />
          <Route path="/documents" element={<ProtectedRoute element={<Document />} />} />
          <Route path="/folder" element={<ProtectedRoute element={<Folder/>} />} />      
          <Route path="/workflows" element={<ProtectedRoute element={<Workflows />} />} />
          <Route path="/workflow" element={<ProtectedRoute element={<Workflow />} />} />
          <Route path="/mes-taches" element={<ProtectedRoute element={<AssignedTasks />} />} />
          <Route path="/details/:id" element={<ProtectedRoute element={<Details />} />} />
          <Route path="/details_taches/:id" element={<ProtectedRoute element={<DetailsTache />} />} />
          <Route path="/details_workflow/:id" element={<ProtectedRoute element={<DetailsWorkflow />} />} />
          <Route path="/register" element={<ProtectedRoute element={<Register />} />} />
          <Route path="/Documents/:id" element={<ProtectedRoute element={<DocumentDetails />} />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;
