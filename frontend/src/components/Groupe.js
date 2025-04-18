import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import Select from 'react-select';
import { Modal, Button, Table, Form } from 'react-bootstrap';

const API = 'http://localhost:5000/api/groups';
const USERS_API = 'http://localhost:5000/api/auth/users/';

const Groupe = () => {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ nom: '', description: '', user_ids: [] });
  const [editId, setEditId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const token = localStorage.getItem('token');
  const axiosAuth = axios.create({ headers: { Authorization: `Bearer ${token}` } });

  useEffect(() => {
    if (token) {
      const decoded = jwtDecode(token);
      setCurrentUser(decoded);
    }
    fetchGroups();
    fetchUsers();
  }, []);

    // Utilisation de useEffect pour observer la mise à jour de currentUser
    useEffect(() => {
        if (currentUser) {
          console.log('Utilisateur connecté page groupe:', currentUser);  // Affichage des infos utilisateur après mise à jour
        }
      }, [currentUser]); // Ce useEffect sera déclenché à chaque modification de currentUser

  const fetchGroups = async () => {
    try {
      const res = await axiosAuth.get(API);
      setGroups(res.data);
    } catch (err) {
      console.error('Erreur récupération groupes :', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axiosAuth.get(USERS_API);
      setUsers(res.data);
    } catch (err) {
      console.error('Erreur récupération utilisateurs :', err);
    }
  };

  const handleSelectChange = (selectedOptions) => {
    const ids = selectedOptions.map(opt => opt.value);
    setForm(prev => ({ ...prev, user_ids: ids }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await axiosAuth.put(`${API}/${editId}`, form);
      } else {
        await axiosAuth.post(API, form);
      }
      resetForm();
      fetchGroups();
    } catch (err) {
      console.error('Erreur enregistrement groupe :', err);
    }
  };

  const resetForm = () => {
    setForm({ nom: '', description: '', user_ids: [] });
    setEditId(null);
    setShowModal(false);
  };

  const handleEdit = (group) => {
    setForm(group);
    setEditId(group.id);
    setShowModal(true);
  };

  const confirmDelete = (id) => {
    setDeleteId(id);
    setShowConfirm(true);
  };

  const handleDelete = async () => {
    try {
      await axiosAuth.delete(`${API}/${deleteId}`);
      setShowConfirm(false);
      setDeleteId(null);
      fetchGroups();
    } catch (err) {
      console.error('Erreur suppression :', err);
    }
  };

  const getUserName = (id) => {
    const user = users.find(u => u.id === id);
    return user ? `${user.name} ${user.prenom}` : `ID:${id}`;
  };

  const userOptions = users.map(u => ({
    value: u.id,
    label: `${u.name} ${u.prenom}`,
  }));

  const selectedUserOptions = userOptions.filter(opt => form.user_ids.includes(opt.value));

  return (
    <div className="container-fluid mt-4">
      <Button variant="success" onClick={() => setShowModal(true)} className="mb-3">
        Ajouter Groupe
      </Button>

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Description</th>
            <th>Utilisateurs</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <tr key={g.id}>
              <td>{g.nom}</td>
              <td>{g.description}</td>
              <td>
                {g.user_ids?.map(id => (
                  <div key={id}>{getUserName(id)}</div>
                ))}
              </td>
              <td>
                <Button size="sm" variant="warning" className="me-2" onClick={() => handleEdit(g)}>
                  Modifier
                </Button>
                <Button size="sm" variant="danger" onClick={() => confirmDelete(g.id)}>
                  Supprimer
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Modal Ajout / Modification */}
      <Modal show={showModal} onHide={resetForm} style={{ zIndex: 1050 }}
  backdrop="static"
  centered>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editId ? 'Modifier Groupe' : 'Ajouter Groupe'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Nom</Form.Label>
              <Form.Control
                type="text"
                name="nom"
                value={form.nom}
                onChange={handleChange}
                placeholder="Nom du groupe"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Description du groupe"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Utilisateurs</Form.Label>
              <Select
                isMulti
                options={userOptions}
                value={selectedUserOptions}
                onChange={handleSelectChange}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={resetForm}>Annuler</Button>
            <Button variant="success" type="submit">
              {editId ? 'Modifier' : 'Ajouter'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal Confirmation Suppression */}
      <Modal show={showConfirm} onHide={() => setShowConfirm(false)} style={{ zIndex: 1050 }}
  backdrop="static"
  centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirmation</Modal.Title>
        </Modal.Header>
        <Modal.Body>Voulez-vous vraiment supprimer ce groupe ?</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>Annuler</Button>
          <Button variant="danger" onClick={handleDelete}>Supprimer</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Groupe;
