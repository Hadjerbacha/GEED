import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

const Details = () => {
    const { id } = useParams();
    console.log("ID de la tâche :", id); // Vérifiez si l'ID est correct
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTaskDetails = async () => {
      try {
        const token = localStorage.getItem("token"); // 🟡 Assure-toi que le token est bien stocké ici
        const response = await axios.get("http://localhost:5000/api/tasks/", {
          headers: {
            Authorization: `Bearer ${token}`, // ✅ Envoie le token dans l'en-tête
          },
        });
        console.log(response.data); 
        const allTasks = response.data;
        const foundTask = allTasks.find((t) => t.id.toString() === id); // Comparaison des chaînes de caractères


        if (foundTask) {
          setTask(foundTask);
        } else {
          setError("Tâche introuvable");
        }
      } catch (err) {
        setError("Erreur lors de la récupération des données");
      } finally {
        setLoading(false);
      }
    };

    fetchTaskDetails();
  }, [id]);

  if (loading) {
    return <div className="container mt-5">Chargement...</div>;
  }

  if (error) {
    return <div className="container mt-5 text-danger">{error}</div>;
  }

  return (
    <div className="container mt-5 d-flex justify-content-center">
    <div className="card shadow-sm w-100" style={{ maxWidth: "800px" }}>
      <div className="card-header bg-primary text-white">
        <h4>Détails de la Tâche</h4>
      </div>
      <div className="card-body">
        <p><strong>ID :</strong> {task.id}</p>
        <p><strong>Nom de la tâche :</strong> {task.title}</p>
        <p><strong>Description :</strong> {task.description}</p>
        <p><strong>Date d'échéance :</strong> {new Date(task.due_date).toLocaleString()}</p>
        <p><strong>Priorité :</strong> {task.priority}</p>
        <p><strong>Fichier :</strong> {task.file ? (
          <a href={`http://localhost:5000/${task.file}`} target="_blank" rel="noopener noreferrer">
            Télécharger
          </a>
        ) : "Aucun fichier"}</p>
        <p><strong>Statut :</strong> {task.status}</p>
        <p><strong>Assignée à :</strong> {task.assigned_to ? task.assigned_to.name : "Non assignée"}</p>
        <p><strong>Assignée par :</strong> {task.assigned_by ? task.assigned_by.name : "Non assignée"}</p>
        <p><strong>Date de création :</strong> {new Date(task.created_at).toLocaleString()}</p>
      </div>
      <div className="card-footer">
        <a href="/workflows" className="btn btn-secondary">Retour</a>
      </div>
    </div>
  </div>
  );
};

export default Details;
