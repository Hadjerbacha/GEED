// src/pages/AssignedTasks.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Table } from 'react-bootstrap';
import '../style/task.css';
import Navbar from './Navbar';

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

  return (
    <div className="container-fluid mt-4">
      <br />
      <Navbar />
      <h2 className="mb-4">📋 Tâches assignées à moi</h2>

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
              <th>Statut</th>
              <th>D'après</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td>{task.description}</td>
                <td>{new Date(task.due_date).toLocaleDateString()}</td>
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
                <td>{task.created_by}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default AssignedTasks;
