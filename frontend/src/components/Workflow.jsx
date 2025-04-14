import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Modal, Button, Form, Table, Pagination } from 'react-bootstrap';
import Select from 'react-select';

const Workflow = () => {
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('new');
  const [tasks, setTasks] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: '',
    assigned_to: [],
    file: null,
    notify: false,
    assignment_note: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const tasksPerPage = 5;

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/tasks/');
      setTasks(response.data);
    } catch (err) {
      console.error('Erreur de chargement des tâches', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/auth/users/');
      const formattedUsers = response.data.map(user => ({
        label: `${user.name} ${user.prenom}`,
        value: user.id
      }));
      setUsers(formattedUsers);
    } catch (err) {
      console.error('Erreur de chargement des utilisateurs', err);
    }
  };

  const handleInputChange = e => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else if (type === 'file') {
      setFormData({ ...formData, file: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleModalOpen = type => {
    setModalType(type);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setFormData({
      title: '',
      description: '',
      due_date: '',
      priority: '',
      assigned_to: [],
      file: null,
      notify: false,
      assignment_note: ''
    });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const data = new FormData();

    if (modalType === 'new') {
      data.append('title', formData.title);
      data.append('description', formData.description);
      data.append('due_date', formData.due_date);
      data.append('priority', formData.priority);
      data.append('assigned_to', formData.assigned_to);
    } else {
      data.append('assignment_note', formData.assignment_note);
      data.append('assigned_to', JSON.stringify(formData.assigned_to));
    }

    if (formData.file) data.append('file', formData.file);
    data.append('notify', formData.notify);

    try {
      const endpoint = modalType === 'new' ? 'http://localhost:5000/api/tasks/' : 'http://localhost:5000/api/tasks/assign-task';
      await axios.post(endpoint, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchTasks();
      handleModalClose();
    } catch (err) {
      console.error("Erreur lors de l'envoi du formulaire :", err);
    }
  };

  const handleSelectChange = selectedOptions => {
    setFormData({ ...formData, assigned_to: selectedOptions.map(option => option.value) });
  };
  const filteredTasks = tasks.filter(task =>
    (task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     task.description?.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  
  

  const indexOfLastTask = currentPage * tasksPerPage;
  const indexOfFirstTask = indexOfLastTask - tasksPerPage;
  const currentTasks = filteredTasks.slice(indexOfFirstTask, indexOfLastTask);

  const paginate = pageNumber => setCurrentPage(pageNumber);

  const handleDelete = async (taskId) => {
    // Confirmation de suppression
    const confirmDelete = window.confirm("Êtes-vous sûr de vouloir supprimer cette tâche ?");
    
    if (confirmDelete) {
      try {
        // Suppression de la tâche avec axios
        await axios.delete(`http://localhost:5000/api/tasks/${taskId}`);
        alert('Tâche supprimée avec succès !');
        fetchTasks(); // Recharger les tâches après suppression
      } catch (err) {
        console.error("Erreur lors de la suppression de la tâche", err);
        alert("Une erreur est survenue lors de la suppression de la tâche.");
      }
    }
  };
  
  
  return (
    <div className="container-fluid mt-4">

      <h2 className="mb-4">Gestion des Workflows</h2>

      <div className="d-flex justify-content-between mb-3">
        <Form.Select
          onChange={e => handleModalOpen(e.target.value)}
          className="w-auto"
        >
          <option>-- Choisir une action --</option>
          <option value="new">Nouvelle tâche</option>
          <option value="assign">Assigner tâche</option>
        </Form.Select>

        <Form.Control
          type="text"
          placeholder="Rechercher une tâche"
          className="w-25"
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>
<div>
      {/* Tableau des tâches */}
      <Table striped bordered hover >
        <thead>
          <tr>
            <th>Titre</th>
            <th>Description</th>
            <th>Échéance</th>
            <th>Priorité</th>
            <th>Fichier</th>
            <th>Statut</th>
            <th>Assignée à</th>
            <th>Assignée par</th>
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
                  <a href={`http://localhost:5000/${task.file_path}`} target="_blank" rel="noreferrer">
                    Voir le fichier
                  </a>
                )}
              </td>
              <td>{task.status}</td>
              <td>{task.assigned_to}</td>
              <td>{task.assigned_by}</td>
              <td>
                <Button variant="warning" onClick={() => handleModalOpen('edit', task)}>Modifier</Button>
                <Button variant="danger" onClick={() => handleDelete(task.id)} className="ml-2">Supprimer</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      </div>
      <Pagination>
        {Array.from({ length: Math.ceil(filteredTasks.length / tasksPerPage) }, (_, i) => (
          <Pagination.Item key={i + 1} onClick={() => paginate(i + 1)} active={i + 1 === currentPage}>
            {i + 1}
          </Pagination.Item>
        ))}
      </Pagination>

      {/* Modal d'ajout / assignation */}
      <Modal show={showModal} onHide={handleModalClose}>
        <Modal.Header closeButton>
          <Modal.Title>{modalType === 'new' ? 'Nouvelle tâche' : 'Assigner une tâche'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            {modalType === 'new' && (
              <>
                <Form.Group>
                  <Form.Label>Titre</Form.Label>
                  <Form.Control type="text" name="title" onChange={handleInputChange} required />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Description</Form.Label>
                  <Form.Control as="textarea" name="description" onChange={handleInputChange} required />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Date d’échéance</Form.Label>
                  <Form.Control type="date" name="due_date" onChange={handleInputChange} required />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Priorité</Form.Label>
                  <Form.Select name="priority" onChange={handleInputChange}>
                    <option value="">Choisir...</option>
                    <option value="Haute">Haute</option>
                    <option value="Moyenne">Moyenne</option>
                    <option value="Basse">Basse</option>
                  </Form.Select>
                </Form.Group>
              </>
            )}
            {modalType === 'assign' && (
              <>
                <Form.Group>
                  <Form.Label>Note d’assignation</Form.Label>
                  <Form.Control as="textarea" name="assignment_note" onChange={handleInputChange} />
                </Form.Group>
              </>
            )}

            <Form.Group>
              <Form.Label>Assigner à</Form.Label>
              <Select
                isMulti
                name="assigned_to"
                options={users}
                onChange={handleSelectChange}
                closeMenuOnSelect={false}
                placeholder="Rechercher un utilisateur"
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Joindre un fichier</Form.Label>
              <Form.Control type="file" name="file" onChange={handleInputChange} />
            </Form.Group>

            <Form.Group className="mt-2">
              <Form.Check type="checkbox" label="Envoyer une notification par email" name="notify" onChange={handleInputChange} />
            </Form.Group>

            <Button className="mt-3" variant="primary" type="submit">
              {modalType === 'new' ? 'Ajouter la tâche' : 'Assigner'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Workflow;
