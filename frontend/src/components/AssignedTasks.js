// src/pages/AssignedTasks.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Table, Pagination } from 'react-bootstrap';
import '../style/task.css';
import Navbar from './Navbar';
import { Modal, Button, Form } from 'react-bootstrap';

// Fonction pour décoder le token JWT
function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    console.error("Erreur de parsing du token :", e);
    return null;
  }
}

const AssignedTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState({
    pending: 0,
    assigned: 0,
    in_progress: 0,
    completed: 0,
  });
  
  
  const token = localStorage.getItem('token');
  const decodedToken = token ? parseJwt(token) : null;
  const userId = decodedToken?.id;

  // Vérification du token et de l'ID de l'utilisateur
  useEffect(() => {
    console.log("Token:", token);
    console.log("User ID:", userId);
    if (!token || !userId) {
      setError('L\'utilisateur n\'est pas connecté ou les informations sont incorrectes.');
      console.error("Token ou userId non valides.");
    }
  }, [token, userId]);

  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    const fetchTasks = async () => {
      if (!userId || !token) {
        return;
      }

      try {
        const response = await axios.get('http://localhost:5000/api/tasks/mes-taches', axiosConfig);
        console.log("Réponse des tâches:", response.data);

        // Filtrer les tâches assignées à l'utilisateur connecté
        const assignedTasks = response.data.filter(task => {
          console.log("Assigned_to:", task.assigned_to);
          return task.assigned_to && Array.isArray(task.assigned_to) && task.assigned_to.includes(userId);
        });

        console.log("Tâches assignées à l'utilisateur:", assignedTasks);
        setTasks(assignedTasks);
        const statusCounts = {
            pending: 0,
            assigned: 0,
            in_progress: 0,
            completed: 0,
          };
      
          assignedTasks.forEach(task => {
            if (task.status in statusCounts) {
              statusCounts[task.status]++;
            }
          });
      
          setStats(statusCounts);
      } catch (error) {
        setError("Erreur lors de la récupération des tâches.");
        console.error("Erreur lors de la récupération des tâches :", error);
      }
    };

    if (token && userId) fetchTasks();
  }, [userId, token]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'assigned': return 'warning';
      case 'in_progress': return 'primary';
      case 'completed': return 'success';
      default: return 'light';
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await fetch(`http://localhost:5000/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Erreur lors de la mise à jour du statut');

      const updatedTask = await res.json();

      setTasks(prev =>
        prev.map(task => (task.id === taskId ? updatedTask : task))
      );
    } catch (error) {
      console.error("Erreur de mise à jour automatique :", error);
      alert("❌ Impossible de changer le statut !");
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'haute': return 'danger';
      case 'moyenne': return 'warning';
      case 'basse': return 'info';
      default: return 'secondary';
    }
  };

  const handleOpenModal = (task) => {
    setSelectedTask(task);
    setCommentText(task.assignment_note || '');
    setShowModal(true);
  };
  
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTask(null);
    setCommentText('');
  };
  
  const handleSaveComment = async () => {
    try {
      const res = await axios.patch(`http://localhost:5000/api/tasks/${selectedTask.id}/comment`, {
        assignment_note: commentText,
      }, axiosConfig);
  
      // Met à jour la tâche localement
      setTasks(prev =>
        prev.map(task => (task.id === selectedTask.id ? res.data : task))
      );
  
      handleCloseModal();
    } catch (err) {
      console.error("Erreur d'ajout du commentaire :", err);
      alert("❌ Impossible d’ajouter le commentaire");
    }
  };

  // Logique de filtrage des tâches
  const tasksPerPage = 10;
  const filteredTasks = tasks.filter(task =>
    (task.title?.toLowerCase().includes(search.toLowerCase()) ||
    task.description?.toLowerCase().includes(search.toLowerCase()) ||
    task.created_by_name?.toLowerCase().includes(search.toLowerCase()))  // Filtrage par nom ou prénom du créateur
);
  


  // Pagination des tâches filtrées
  const currentTasks = filteredTasks.slice((currentPage - 1) * tasksPerPage, currentPage * tasksPerPage);


  
  return (
    <div className="container-fluid mt-4">
      <Navbar />

      <div className="d-flex justify-content-end align-items-center mb-3">
  <Form.Control
    type="text"
    placeholder="Rechercher..."
    style={{ width: '300px' }}
    onChange={e => setSearch(e.target.value)}
  />
</div>

      <div className="row mb-4">
  <div className="col-md-3">
    <div className="card text-white bg-success shadow">
      <div className="card-body">
        <h5 className="card-title">✅ Terminées</h5>
        <p className="card-text fs-4">{stats.completed}</p>
      </div>
    </div>
  </div>
  <div className="col-md-3">
    <div className="card text-white bg-primary shadow">
      <div className="card-body">
        <h5 className="card-title">🔧 En cours</h5>
        <p className="card-text fs-4">{stats.in_progress}</p>
      </div>
    </div>
  </div>
  <div className="col-md-3">
    <div className="card text-white bg-warning shadow">
      <div className="card-body">
        <h5 className="card-title">📌 Assignées</h5>
        <p className="card-text fs-4">{stats.assigned}</p>
      </div>
    </div>
  </div>
  <div className="col-md-3">
    <div className="card text-white bg-secondary shadow">
      <div className="card-body">
        <h5 className="card-title">⏳ En attente</h5>
        <p className="card-text fs-4">{stats.pending}</p>
      </div>
    </div>
  </div>
</div>

      {error && <p className="text-danger">{error}</p>}

      {tasks.length === 0 ? (
        <p>Aucune tâche assignée.</p>
      ) : (
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Titre</th>
              <th>Description</th>
              <th>Échéance</th>
              <th>Temps restant</th>
              <th>Priorité</th>
              <th>Statut</th>
              <th>D'après</th>
              <th>Fichier</th>
              <th>💬 Commentaire</th>

            </tr>
          </thead>
          <tbody>
             {currentTasks.map(task => (
             <tr
             key={task.id}
             className={
               new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'table-danger' : ''
             }
           >
           
                <td>{task.title}</td>
                <td>{task.description}</td>
                <td>{new Date(task.due_date).toLocaleDateString()}</td>
                <td>
                {(() => {
                    const today = new Date();
                    const dueDate = new Date(task.due_date);
                    const diffTime = dueDate - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays >= 0 ? `${diffDays} jour(s)` : "⛔ Dépassée";
                })()}
                </td>
                <td className={getPriorityColor(task.priority)}>
                    {task.priority}
                </td>
                <td>
                  <select
                    value={task.status}
                    className={`form-select form-select-sm bg-${getStatusColor(task.status)} text-white`}
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                  >
                    <option value="pending" className="text-dark">⏳ En attente</option>
                    <option value="assigned" className="text-dark">📌 Assignée</option>
                    <option value="in_progress" className="text-dark">🔧 En cours</option>
                    <option value="completed" className="text-dark">✅ Terminée</option>
                  </select>
                </td>
                <td>{task.created_by_name}</td>
                <td>
  {task.file_path && task.file_path !== '/uploads/' ? (
    <a href={`http://localhost:5000${task.file_path}`} target="_blank" rel="noreferrer">Voir</a>
  ) : "-"}
</td>

                <td>
                <Button size="sm" variant="info" onClick={() => handleOpenModal(task)}>
                    💬 Voir / Ajouter
                </Button>
                </td>

              </tr>
            ))}
          </tbody>
        </Table>
      )}

        {/* Pagination */}
        <Pagination>
                {Array.from({ length: Math.ceil(filteredTasks.length / tasksPerPage) }, (_, idx) => (
                <Pagination.Item
                    key={idx + 1}
                    active={idx + 1 === currentPage}
                    onClick={() => setCurrentPage(idx + 1)}
                >
                    {idx + 1}
                </Pagination.Item>
                ))}
            </Pagination>

      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
            <Modal.Title>💬 Commentaire sur la tâche</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <Form>
            <Form.Group controlId="commentTextArea">
                <Form.Label>Commentaire</Form.Label>
                <Form.Control
                as="textarea"
                rows={4}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Ajoutez un commentaire ici..."
                />
            </Form.Group>
            </Form>
        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
            Annuler
            </Button>
            <Button variant="primary" onClick={handleSaveComment}>
            💾 Enregistrer
            </Button>
        </Modal.Footer>
        </Modal>

    </div>
  );
  
};

export default AssignedTasks;
