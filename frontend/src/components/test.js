// WorkflowPage.js
import React, { useEffect, useState } from "react";
import {
  Button,
  Form,
  Modal,
  Table,
  Spinner,
  Alert,
} from "react-bootstrap";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import moment from "moment";
import { FaTrash, FaEdit, FaSearch, FaRobot } from "react-icons/fa";

const WorkflowPage = () => {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "moyenne",
    assigned_to: "",
    file: null,
    notify: false,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("due_date");
  const [sortOrder, setSortOrder] = useState("asc");

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/tasks");
      setTasks(res.data);
      setFilteredTasks(res.data);
    } catch (err) {
      toast.error("Erreur lors du chargement des tâches.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    const filtered = tasks.filter((task) =>
      task.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTasks(filtered);
  }, [searchTerm, tasks]);

  const sortTasks = (key) => {
    const order = sortKey === key && sortOrder === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortOrder(order);
    const sorted = [...filteredTasks].sort((a, b) => {
      if (order === "asc") return a[key] > b[key] ? 1 : -1;
      return a[key] < b[key] ? 1 : -1;
    });
    setFilteredTasks(sorted);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    const val = type === "checkbox" ? checked : type === "file" ? files[0] : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const validateForm = () => {
    if (!formData.title || !formData.due_date || !formData.priority || !formData.assigned_to) {
      toast.warning("Veuillez remplir tous les champs obligatoires.");
      return false;
    }
    if (moment(formData.due_date).isBefore(moment())) {
      toast.warning("La date d'échéance doit être future.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = new FormData();
    Object.entries(formData).forEach(([key, val]) =>
      payload.append(key, val)
    );

    try {
      await axios.post("/api/tasks", payload);
      toast.success("Tâche ajoutée avec succès !");
      setShowModal(false);
      setFormData({
        title: "",
        description: "",
        due_date: "",
        priority: "moyenne",
        assigned_to: "",
        file: null,
        notify: false,
      });
      setAiSuggestion("");
      fetchTasks();
    } catch (err) {
      toast.error("Erreur lors de l'ajout de la tâche.");
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "haute":
        return "danger";
      case "moyenne":
        return "warning";
      case "basse":
        return "success";
      default:
        return "secondary";
    }
  };

  const generateAISuggestion = async () => {
    if (!formData.description) {
      toast.warning("Veuillez d'abord saisir une description.");
      return;
    }
    try {
      const res = await axios.post("/api/ai/suggest-title", {
        description: formData.description,
      });
      setAiSuggestion(res.data.suggestion);
      setFormData((prev) => ({ ...prev, title: res.data.suggestion }));
      toast.info("Suggestion IA appliquée au titre.");
    } catch (err) {
      toast.error("Erreur lors de la suggestion IA.");
    }
  };

  return (
    <div className="container-fluid mt-4">
      <ToastContainer />
      <h2 className="mb-4 text-center">Gestion des Workflows</h2>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <Button variant="primary" onClick={() => setShowModal(true)}>
          Nouvelle Tâche
        </Button>
        <Form.Control
          type="text"
          placeholder="Rechercher une tâche..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: "250px" }}
        />
      </div>

      {loading ? (
        <div className="text-center">
          <Spinner animation="border" />
        </div>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th onClick={() => sortTasks("title")}>Titre</th>
              <th onClick={() => sortTasks("due_date")}>Échéance</th>
              <th onClick={() => sortTasks("priority")}>Priorité</th>
              <th>Assigné à</th>
              <th>Fichier</th>
              <th>État</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((task) => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td>{moment(task.due_date).format("DD/MM/YYYY")}</td>
                <td>
                  <Alert
                    variant={getPriorityColor(task.priority)}
                    className="py-1 text-center mb-0"
                  >
                    {task.priority}
                  </Alert>
                </td>
                <td>{task.assigned_to_name || "—"}</td>
                <td>
                  {task.file ? (
                    <a href={task.file} target="_blank" rel="noreferrer">
                      Voir
                    </a>
                  ) : (
                    "Aucun"
                  )}
                </td>
                <td>{task.status || "En attente"}</td>
                <td>
                  <Button size="sm" variant="outline-warning" className="me-2">
                    <FaEdit />
                  </Button>
                  <Button size="sm" variant="outline-danger">
                    <FaTrash />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)} style={{ zIndex: 1050, width: '100%' }}>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Ajouter une Tâche</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-2">
              <Form.Label>Titre *</Form.Label>
              <Form.Control
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
              />
              {aiSuggestion && <small className="text-success">Suggestion IA: {aiSuggestion}</small>}
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={generateAISuggestion}
                className="mt-1"
              >
                <FaRobot /> Suggérer un titre IA
              </Button>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Date d'échéance *</Form.Label>
              <Form.Control
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleInputChange}
                required
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Priorité *</Form.Label>
              <Form.Select
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                required
              >
                <option value="haute">Haute</option>
                <option value="moyenne">Moyenne</option>
                <option value="basse">Basse</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Assigné à (ID utilisateur) *</Form.Label>
              <Form.Control
                type="text"
                name="assigned_to"
                value={formData.assigned_to}
                onChange={handleInputChange}
                required
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Fichier</Form.Label>
              <Form.Control type="file" name="file" onChange={handleInputChange} />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Check
                type="checkbox"
                name="notify"
                checked={formData.notify}
                onChange={handleInputChange}
                label="Envoyer une notification"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary">
              Enregistrer
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkflowPage;

