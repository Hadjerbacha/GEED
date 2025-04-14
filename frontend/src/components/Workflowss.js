import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Modal, Button, Form, Table, Pagination } from 'react-bootstrap';
import Select from 'react-select';

const Workflowss = () => {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: '',
    assigned_to: [],
    file: null,
    notify: false,
  });

  const tasksPerPage = 5;

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/tasks/');
      setTasks(res.data);
    } catch (err) {
      console.error('Erreur chargement des tâches', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/auth/users/');
      const formatted = res.data.map(u => ({ value: u.id, label: `${u.name} ${u.prenom}` }));
      setUsers(formatted);
    } catch (err) {
      console.error('Erreur chargement des utilisateurs', err);
    }
  };

  const openModal = task => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description,
        due_date: task.due_date?.split('T')[0],
        priority: task.priority,
        assigned_to: task.assigned_ids || [],
        file: null,
        notify: false
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      due_date: '',
      priority: '',
      assigned_to: [],
      file: null,
      notify: false
    });
  };

  const closeModal = () => {
    resetForm();
    setShowModal(false);
  };

  const handleInputChange = e => {
    const { name, value, type, checked, files } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'file' ? files[0] : value
    }));
  };

  const handleSelectChange = selected => {
    setFormData(prev => ({ ...prev, assigned_to: selected.map(s => s.value) }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const data = new FormData();
    for (const key in formData) {
      if (key === 'assigned_to') {
        data.append(key, JSON.stringify(formData[key]));
      } else if (formData[key]) {
        data.append(key, formData[key]);
      }
    }

    const endpoint = editingTask
      ? `http://localhost:5000/api/tasks/${editingTask.id}`
      : 'http://localhost:5000/api/tasks/';

    try {
      await axios({
        method: editingTask ? 'put' : 'post',
        url: endpoint,
        data,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchTasks();
      closeModal();
    } catch (err) {
      console.error("Erreur d'enregistrement :", err);
    }
  };

  const handleDelete = async id => {
    if (window.confirm("Confirmer la suppression ?")) {
      try {
        await axios.delete(`http://localhost:5000/api/tasks/${id}`);
        fetchTasks();
      } catch (err) {
        console.error("Erreur suppression :", err);
      }
    }
  };

  const filteredTasks = tasks.filter(task =>
    task.title?.toLowerCase().includes(search.toLowerCase()) ||
    task.description?.toLowerCase().includes(search.toLowerCase())
  );

  const currentTasks = filteredTasks.slice((currentPage - 1) * tasksPerPage, currentPage * tasksPerPage);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'assigned': return 'info';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
      default: return 'light';
    }
  };
  
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await fetch(`http://localhost:5000/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Erreur lors de la mise à jour du statut');
      const updatedTask = await res.json();
      setTasks(tasks.map(task => task.id === taskId ? updatedTask : task));
    } catch (err) {
      console.error(err);
      alert("Impossible de changer le statut !");
    }
  };
  
  return (
    <div className="container-fluid mt-4">
      <h2 className="mb-4">Gestion des Workflows</h2>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <Button onClick={() => openModal(null)}>Nouvelle Tâche</Button>
        <Form.Control
          type="text"
          placeholder="Rechercher..."
          style={{ width: '300px' }}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Titre</th>
            <th>Description</th>
            <th>Échéance</th>
            <th>Priorité</th>
            <th>Fichier</th>
            <th>Statut</th>
            <th>Assignée à</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {currentTasks.map(task => (
            <tr key={task.id}>
              <td>{task.title}</td>
              <td>{task.description}</td>
              <td>{new Date(task.due_date).toLocaleDateString()}</td>
              <td>{task.priority}</td>
              <td>
                {task.file_path && (
                  <a href={`http://localhost:5000${task.file_path}`} target="_blank" rel="noreferrer">Voir</a>
                )}
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

<td>
  {users
    .filter(u => task.assigned_to?.includes(u.value))
    .map(u => u.label)
    .join(', ')}
</td>

              <td>
                <Button size="sm" variant="warning" onClick={() => openModal(task)}>Modifier</Button>{' '}
                <Button size="sm" variant="danger" onClick={() => handleDelete(task.id)}>Supprimer</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

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

      {/* MODAL */}
      <Modal show={showModal} onHide={closeModal}>
        <Modal.Header closeButton>
          <Modal.Title>{editingTask ? 'Modifier Tâche' : 'Nouvelle Tâche'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group>
              <Form.Label>Titre</Form.Label>
              <Form.Control name="title" value={formData.title} onChange={handleInputChange} required />
            </Form.Group>
            <Form.Group>
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" name="description" value={formData.description} onChange={handleInputChange} required />
            </Form.Group>
            <Form.Group>
              <Form.Label>Échéance</Form.Label>
              <Form.Control type="date" name="due_date" value={formData.due_date} onChange={handleInputChange} required />
            </Form.Group>
            <Form.Group>
              <Form.Label>Priorité</Form.Label>
              <Form.Select name="priority" value={formData.priority} onChange={handleInputChange}>
                <option value="">Choisir...</option>
                <option value="Haute">Haute</option>
                <option value="Moyenne">Moyenne</option>
                <option value="Basse">Basse</option>
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>Assigner à</Form.Label>
              <Select
                isMulti
                options={users}
                value={users.filter(u => formData.assigned_to.includes(u.value))}
                onChange={handleSelectChange}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Fichier</Form.Label>
              <Form.Control type="file" name="file" onChange={handleInputChange} />
            </Form.Group>
            <Form.Group className="mt-2">
              <Form.Check type="checkbox" name="notify" label="Notifier par Email" checked={formData.notify} onChange={handleInputChange} />
            </Form.Group>
            <Button variant="primary" type="submit" className="mt-3">
              {editingTask ? 'Modifier' : 'Créer'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Workflowss;
