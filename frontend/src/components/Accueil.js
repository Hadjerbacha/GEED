import React, { useEffect, useState } from "react";
import axios from "axios";
import Navbar from './Navbar';
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "bootstrap/dist/css/bootstrap.min.css";
import './Dashboard.css';
import docImage from './img/doc.jpg';
import workflowImage from './img/workflow.png';
import notifImage from './img/notif.jpg';
import todoImage from './img/todo.jpg';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFileAlt, 
  faTasks, 
  faBell, 
  faClock, 
  faChevronRight,
  faCheckCircle,
  faExclamationTriangle,
  faCalendarAlt
} from '@fortawesome/free-solid-svg-icons';
import { Chart, registerables } from 'chart.js';

// Enregistrement des composants Chart.js
Chart.register(...registerables);

const Accueil = () => {
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [lateWorkflows, setLateWorkflows] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [userId, setUserId] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats] = useState({
    documents: 0,
    workflows: 0,
    tasks: 0
  });
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

    // Récupérer les statistiques
    axios.get("http://localhost:5000/api/dashboard/stats", config)
      .then(res => setStats(res.data))
      .catch(err => console.error("Erreur stats :", err));

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
    axios.get(`http://localhost:5000/api/notifications/${currentUser.id}`, config)
      .then(res => {
        const formattedNotifications = res.data.slice(0, 5).map(notification => ({
          ...notification,
          message: notification.message,
        }));
        setNotifications(formattedNotifications);
      })
      .catch(err => console.error("Erreur notifications :", err));

  }, [currentUser, token]);

  // Initialiser les graphiques
  useEffect(() => {
    if (assignedTasks.length > 0) {
      initTaskChart();
    }

    // Nettoyage lors du démontage du composant
    return () => {
      const ctx = document.getElementById('taskChart');
      if (ctx && ctx.chart) {
        ctx.chart.destroy();
      }
    };
  }, [assignedTasks]);

  const initTaskChart = () => {
    const ctx = document.getElementById('taskChart');
    if (!ctx) return;

    // Détruire le graphique existant s'il y en a un
    if (ctx.chart) {
      ctx.chart.destroy();
    }

    const statusCounts = assignedTasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});

    ctx.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(statusCounts),
        datasets: [{
          data: Object.values(statusCounts),
          backgroundColor: [
            '#4e73df',
            '#1cc88a',
            '#36b9cc',
            '#f6c23e',
            '#e74a3b'
          ],
          hoverBackgroundColor: [
            '#2e59d9',
            '#17a673',
            '#2c9faf',
            '#dda20a',
            '#be2617'
          ],
          hoverBorderColor: "rgba(234, 236, 244, 1)",
        }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        },
        cutout: '70%',
      },
    });
  };

  return (
    <>
      <Navbar />
      <div className="container-fluid mt-4">

        {/* Cartes de statistiques */}
        <div className="row mb-4">
          <StatCard 
            title="Documents" 
            value={stats.documents} 
            icon={faFileAlt} 
            color="primary" 
            onClick={() => navigate("/documents")}
          />
          <StatCard 
            title="Workflows" 
            value={stats.workflows} 
            icon={faTasks} 
            color="success" 
            onClick={() => navigate("/workflow")}
          />
          <StatCard 
            title="Tâches" 
            value={stats.tasks} 
            icon={faCheckCircle} 
            color="info" 
            onClick={() => navigate("/mes-taches")}
          />
          <StatCard 
            title="Notifications" 
            value={notifications.length} 
            icon={faBell} 
            color="warning" 
            onClick={() => navigate("/notif")}
          />
        </div>

        {/* Graphique et cartes principales */}
        <div className="row">
          {/* Graphique */}
          <div className="col-xl-4 col-lg-5">
            <div className="card shadow mb-4">
              <div className="card-header py-3 d-flex flex-row align-items-center justify-content-between">
                <h6 className="m-0 font-weight-bold text-primary">Répartition des tâches</h6>
              </div>
              <div className="card-body">
                <div className="chart-pie pt-4 pb-2">
                  <canvas id="taskChart" style={{height: '250px'}}></canvas>
                </div>
              </div>
            </div>
          </div>

          {/* Cartes principales */}
          <div className="col-xl-8 col-lg-7">
            <div className="row">
              <EnhancedCard
                title="Documents Récents"
                items={recentDocuments}
                onClick={() => navigate("/documents")}
                type="doc"
                icon={faFileAlt}
                color="#4e73df"
                emptyMessage="Aucun document récent"
              />

              <EnhancedCard
                title="Tâches Assignées"
                items={assignedTasks}
                onClick={() => navigate("/mes-taches")}
                type="task"
                icon={faTasks}
                color="#1cc88a"
                emptyMessage="Aucune tâche assignée"
              />
            </div>
          </div>
        </div>

        {/* Deuxième ligne de cartes */}
        <div className="row mt-4">
          <EnhancedCard
            title="Workflows en Retard"
            items={lateWorkflows}
            onClick={() => navigate("/workflows")}
            type="workflow"
            icon={faClock}
            color="#e74a3b"
            emptyMessage="Aucun workflow en retard"
            isUrgent={true}
          />

          <EnhancedCard
            title="Notifications"
            items={notifications}
            onClick={() => navigate("/notif")}
            type="notification"
            icon={faBell}
            color="#f6c23e"
            emptyMessage="Aucune notification"
          />
        </div>
      </div>
    </>
  );
};

// Composant de carte de statistiques
const StatCard = ({ title, value, icon, color, onClick }) => (
  <div className="col-xl-3 col-md-6 mb-4" onClick={onClick} style={{ cursor: 'pointer' }}>
    <div className={`card border-left-${color} shadow h-100 py-2`}>
      <div className="card-body">
        <div className="row no-gutters align-items-center">
          <div className="col mr-2">
            <div className={`text-xs font-weight-bold text-${color} text-uppercase mb-1`}>
              {title}
            </div>
            <div className="h5 mb-0 font-weight-bold text-gray-800">{value}</div>
          </div>
          <div className="col-auto">
            <FontAwesomeIcon icon={icon} className={`fa-2x text-gray-300`} />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Composant Card amélioré
const EnhancedCard = ({ title, items, onClick, type, icon, color, emptyMessage, isUrgent }) => (
  <div className="col-md-6 mb-4">
    <div className="card shadow h-100">
      <div 
        className="card-header py-3 d-flex flex-row align-items-center justify-content-between"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <h6 className="m-0 font-weight-bold" style={{ color }}>
          <FontAwesomeIcon icon={icon} className="mr-2" />
          {title}
        </h6>
        <button 
          className="btn btn-sm btn-link" 
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          style={{ color }}
        >
          Voir tout <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>
      <div className="card-body">
        {items?.length > 0 ? (
          <ul className="list-group list-group-flush">
            {items.map(item => (
              <li 
                key={item.id} 
                className="list-group-item d-flex justify-content-between align-items-center px-0 py-2"
              >
                <div>
                  <strong>{item.name || item.title || item.message?.substring(0, 30)}</strong>
                  {item.due_date && (
                    <div className="text-muted small mt-1">
                      <FontAwesomeIcon icon={faCalendarAlt} className="mr-1" />
                      {new Date(item.due_date).toLocaleDateString()}
                      {new Date(item.due_date) < new Date() && (
                        <span className="badge badge-danger ml-2">
                          <FontAwesomeIcon icon={faExclamationTriangle} /> En retard
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {isUrgent && (
                  <span className="badge badge-danger">
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-3 text-muted">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  </div>
);

export default Accueil;