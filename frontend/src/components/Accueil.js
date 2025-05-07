import React, { useEffect, useState } from "react";
import axios from "axios";
import Navbar from './Navbar';
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "bootstrap/dist/css/bootstrap.min.css";
import './Dashboard.css'; // Fichier pour les styles personnalisés
import docImage from './img/doc.jpg';
import workflowImage from './img/workflow.png';
import notifImage from './img/notif.jpg';
import todoImage from './img/todo.jpg';





const Accueil = () => {
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [lateWorkflows, setLateWorkflows] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [notifications, setNotifications] = useState([]); // Etat pour les notifications
  const [userId, setUserId] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // Décoder le token pour récupérer userId
  useEffect(() => {
    if (token) {
      const decoded = jwtDecode(token);
      setUserId(decoded.id);
    }
  }, [token]);

  // Récupérer la liste des utilisateurs
  useEffect(() => {
    fetch('http://localhost:5000/api/auth/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error('Erreur utilisateurs :', err));
  }, []);

  // Déterminer l'utilisateur actuel
  useEffect(() => {
    if (userId && users.length > 0) {
      const found = users.find(u => u.id === userId);
      if (found) setCurrentUser(found);
    }
  }, [userId, users]);

  useEffect(() => {
    if (!token || !currentUser) return;

    const config = { headers: { Authorization: `Bearer ${token}` } };

    // Récupérer les documents récents
    axios.get("http://localhost:5000/api/documents/", config)
      .then(res => setRecentDocuments(res.data.slice(0, 5)))
      .catch(err => console.error("Erreur documents :", err));

    // Récupérer les tâches assignées
    axios.get("http://localhost:5000/api/tasks/mes-taches", config)
      .then(res => {
        const upcoming = res.data.filter(task => {
          const ids = Array.isArray(task.assigned_to) ? task.assigned_to : task.assigned_to?.replace(/[{}]/g, '').split(',').map(Number);
          return ids?.includes(currentUser.id) && task.status !== "completed";
        }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 5);
        setAssignedTasks(upcoming);
      }).catch(err => console.error("Erreur tâches :", err));

    // Récupérer les workflows en retard
    axios.get("http://localhost:5000/api/tasks/", config)
      .then(res => {
        const now = new Date();
        const late = res.data.filter(task => task.created_by === currentUser.id && task.status !== "completed" && new Date(task.due_date) < now).slice(0, 5);
        setLateWorkflows(late);
      }).catch(err => console.error("Erreur workflows :", err));

    // Récupérer les notifications
    // Récupérer les notifications
    axios.get(`http://localhost:5000/api/notifications/${currentUser.id}`, config)
      .then(res => {
        // Ajouter les notifications dans l'état avec les nouveaux attributs
        const formattedNotifications = res.data.slice(0, 5).map(notification => ({
          ...notification,
          message: notification.message,
        }));
        setNotifications(formattedNotifications);
      })
      .catch(err => console.error("Erreur notifications :", err));

  }, [currentUser, token]);

  return (
    <>
      <Navbar />
      <div className="container-fluid py-4">
        <div className="row g-4">
          <Card
            title="Documents Récents"
            items={recentDocuments}
            onClick={() => navigate("/documents")}
            type="doc"
            image={docImage}
          />

          <Card
            title="Workflows en Retard"
            items={lateWorkflows}
            onClick={() => navigate("/workflows")}
            type="workflow"
            image={workflowImage}
          />
          <Card
            title="Tâches Assignées à Vous"
            items={assignedTasks}
            onClick={() => navigate("/mes-taches")}
            type="task"
            image={todoImage}
          />
          {/* Carte pour afficher les notifications */}
          <Card
            title="Notifications"
            items={notifications}
            onClick={() => navigate("/notif")}
            type="notification"
            image={notifImage}
          />
        </div>
      </div>
    </>
  );
};

// Composant Card générique pour l'affichage des éléments
const Card = ({ title, items, onClick, type, image }) => (
  <div className="col-md-6">
    <div className="custom-card p-3" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="custom-card-header mb-2">{title}</div>
      <div className="d-flex align-items-start">
        <div className="flex-grow-1">
          {items?.length > 0 ? items.map(item => (
            <div key={item.id} className="mb-2">
              <strong>{item.name || item.title}</strong>
              <small className="d-block text-muted">
                {item.due_date || item.date ? new Date(item.due_date || item.date).toLocaleDateString() : ''}
              </small>
              {item.message && (
                <p className="mb-0"><strong>-</strong> {item.message}</p>
              )}
            </div>
          )) : <p className="text-muted">Aucun élément</p>}
        </div>

        {image && (
          <img
            src={image}
            alt="Illustration"
            className="ms-3"
            style={{
              width: "150px",
              height: "150px",
              objectFit: "cover",
              borderRadius: "8px",
              flexShrink: 0
            }}
          />
        )}
      </div>
    </div>
  </div>
);


export default Accueil;
