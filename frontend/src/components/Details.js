import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

const Details = () => {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pour la to-do list
  const [todoInput, setTodoInput] = useState("");
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    const fetchTaskDetails = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get("http://localhost:5000/api/tasks/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const allTasks = response.data;
        const foundTask = allTasks.find((t) => t.id.toString() === id);

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

  // Gestion de la to-do
  const handleAddTodo = () => {
    if (todoInput.trim() !== "") {
      setTodos([...todos, { text: todoInput.trim(), done: false }]);
      setTodoInput("");
    }
  };

  const toggleTodo = (index) => {
    const updated = todos.map((todo, i) =>
      i === index ? { ...todo, done: !todo.done } : todo
    );
    setTodos(updated);
  };

  if (loading) return <div className="container mt-5">Chargement...</div>;
  if (error) return <div className="container mt-5 text-danger">{error}</div>;

  return (
    <div className="container-fluid">
  {/* Bouton Retour en haut, large */}
  <div className="m-4">
    <a href="/workflows" className="btn btn-secondary btn-lg w-100">
      Retour
    </a>
  </div>

  {/* Row pour mettre les deux cartes côte à côte */}
  <div className="row justify-content-center px-3">
    {/* Colonne de gauche : Détails */}
    <div className="col-md-6 mb-4">
      <div className="card shadow-sm h-100">
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
            <a href={`http://localhost:5000/${task.file}`} target="_blank" rel="noopener noreferrer">Télécharger</a>
          ) : "Aucun fichier"}</p>
          <p><strong>Statut :</strong> {task.status}</p>
          <p><strong>Assignée à :</strong> {task.assigned_to ? task.assigned_to.name : "Non assignée"}</p>
          <p><strong>Assignée par :</strong> {task.assigned_by ? task.assigned_by.name : "Non assignée"}</p>
          <p><strong>Date de création :</strong> {new Date(task.created_at).toLocaleString()}</p>
        </div>
      </div>
    </div>

    {/* Colonne de droite : Checklist */}
    <div className="col-md-6 mb-4">
      <div className="card shadow-sm h-100">
        <div className="card-header bg-success text-white">
          <h5>Checklist / Sous-tâches</h5>
        </div>
        <div className="card-body">
          <div className="input-group mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Ajouter une sous-tâche..."
              value={todoInput}
              onChange={(e) => setTodoInput(e.target.value)}
            />
            <button className="btn btn-success" onClick={handleAddTodo}>Ajouter</button>
          </div>

          {todos.length > 0 ? (
            <ul className="list-group">
              {todos.map((todo, index) => (
                <li
                  key={index}
                  className={`list-group-item d-flex justify-content-between align-items-center ${
                    todo.done ? "list-group-item-success" : ""
                  }`}
                >
                  <div>
                    <input
                      type="checkbox"
                      className="form-check-input me-2"
                      checked={todo.done}
                      onChange={() => toggleTodo(index)}
                    />
                    <span style={{ textDecoration: todo.done ? "line-through" : "none" }}>
                      {todo.text}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>Aucune sous-tâche ajoutée.</p>
          )}
        </div>
      </div>
    </div>
  </div>
</div>

  );
  
};

export default Details;
