import React, { useEffect, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import Navbar from './Navbar';
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const Accueil = () => {
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [lateWorkflows, setLateWorkflows] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [userId, setUserId] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // Décoder JWT pour récupérer userId
  useEffect(() => {
    if (token) {
      const decoded = jwtDecode(token);
      console.log("🔐 Token décodé:", decoded);
      setUserId(decoded.id);
    }
  }, [token]);

  // Récupérer tous les utilisateurs
  useEffect(() => {
    fetch('http://localhost:5000/api/auth/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error('❌ Erreur chargement utilisateurs :', err));
  }, []);

  // Associer userId au user courant
  useEffect(() => {
    if (userId && users.length > 0) {
      const found = users.find(u => u.id === userId);
      if (found) setCurrentUser(found);
    }
  }, [userId, users]);

  // Récupérer les documents récents, les tâches assignées et les workflows en retard
  useEffect(() => {
    if (!token || !currentUser) return;

    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    // Récupérer les documents récents
    axios.get("http://localhost:5000/api/documents/", config)
      .then(res => {
        setRecentDocuments(res.data.slice(0, 5));
      })
      .catch(err => {
        console.error("❌ Erreur chargement documents :", err);
      });

    // Récupérer les tâches assignées à l'utilisateur (endpoint /mes-taches)
    axios.get("http://localhost:5000/api/tasks/mes-taches", config)
      .then(res => {
        const tasks = res.data;

        // Filtrer les tâches assignées à l'utilisateur et trier par priorité puis par date d'échéance
        const upcoming = tasks
          .filter(task => {
            let assignedIds = [];

            if (Array.isArray(task.assigned_to)) {
              assignedIds = task.assigned_to;
            } else if (typeof task.assigned_to === 'string') {
              assignedIds = task.assigned_to
                .replace(/[{}]/g, '')
                .split(',')
                .map(id => parseInt(id))
                .filter(id => !isNaN(id));
            }

            const isAssigned = assignedIds.includes(currentUser.id);
            const isNotCompleted = task.status !== "completed";

            const include = isAssigned && isNotCompleted;

            if (include) {
              console.log("✅ Tâche assignée à :", currentUser.name ,"-" ,currentUser.prenom);
              console.log("➡️ assigned_to (après parse) :", assignedIds);
            }

            return include;
          })
          .sort((a, b) => {
            // Trier d'abord par priorité, puis par date d'échéance
            const priorityOrder = { haute: 1, moyenne: 2, basse: 3 };
            const priorityA = priorityOrder[a.priority] || 4; // Si priorité non définie, donner une valeur élevée
            const priorityB = priorityOrder[b.priority] || 4;

            // Si la priorité est différente, trier par priorité
            if (priorityA !== priorityB) {
              return priorityA - priorityB;
            }

            // Si la priorité est la même, trier par la date d'échéance
            return new Date(a.due_date) - new Date(b.due_date);
          })
          .slice(0, 5); // Limiter aux 5 premières tâches

        setAssignedTasks(upcoming);
      })
      .catch(err => {
        console.error("❌ Erreur chargement tâches assignées :", err);
      });

    // Récupérer les workflows en retard créés par l'utilisateur (endpoint /tasks)
    axios.get("http://localhost:5000/api/tasks/", config)
      .then(res => {
        const tasks = res.data;
        const now = new Date();

        // Filtrer les workflows en retard créés par l'utilisateur
        const late = tasks.filter(task =>
          task.created_by === currentUser.id &&
          task.status !== "completed" &&
          task.due_date &&
          new Date(task.due_date) < now
        ).slice(0, 5);

        setLateWorkflows(late);
      })
      .catch(err => {
        console.error("❌ Erreur chargement workflows en retard :", err);
      });
  }, [currentUser, token]);

  return (
    <>
      <Navbar />
      <div className="container-fluid py-4">
        <div className="row g-4">
          {/* Documents récents */}
          <div className="col-md-6">
            <div
              className="card shadow-sm clickable-card"
              onClick={() => navigate("/documents")}
              style={{ cursor: "pointer" }}
            >
              <div className="card-header text-white" style={{ backgroundColor: "#2666ce" }}>
                Documents Récents
              </div>
              <div className="card-body">
                {recentDocuments.length > 0 ? recentDocuments.map(doc => (
                  <div key={doc.id} className="mb-2">
                    <strong>{doc.name}</strong> — <small>{new Date(doc.date).toISOString().split("T")[0]}</small>
                  </div>
                )) : <p>Aucun document</p>}
              </div>
            </div>
          </div>

          {/* Workflows en retard */}
          <div className="col-md-6">
            <div
              className="card shadow-sm"
              onClick={() => navigate("/workflows")}
              style={{ cursor: "pointer" }}
            >
              <div className="card-header text-white" style={{ backgroundColor: "#2666ce" }}>Workflows en Retard</div>
              <div className="card-body">
                {lateWorkflows.length > 0 ? lateWorkflows.map(wf => (
                  <div key={wf.id} className="mb-2">
                    <strong>{wf.title}</strong> — <small>Échéance : {new Date(wf.due_date).toISOString().split("T")[0]}</small>
                  </div>
                )) : <p>Pas de workflows en retard</p>}
              </div>
            </div>
          </div>

          {/* Tâches assignées */}
          <div className="col-md-6">
            <div
              className="card shadow-sm"
              onClick={() => navigate("/mes-taches")}
              style={{ cursor: "pointer" }}
            >
              <div className="card-header text-white" style={{ backgroundColor: "#2666ce" }}>Tâches Assignées à Vous</div>
              <div className="card-body">
                {assignedTasks.length > 0 ? assignedTasks.map(task => (
                  <div key={task.id} className="mb-2">
                    <strong>{task.title}</strong> — <small>Avant : {new Date(task.due_date).toISOString().split("T")[0]}</small>
                  </div>
                )) : <p>Aucune tâche assignée</p>}
              </div>
            </div>
          </div>

          {/* Widget personnalisé */}
          <div className="col-md-6">
            <div className="card shadow-sm">
              <div className="card-header text-white" style={{ backgroundColor: "#2666ce" }}>Notifications</div>
              <div className="card-body">
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Accueil;
