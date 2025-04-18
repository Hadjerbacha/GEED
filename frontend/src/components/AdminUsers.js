import React, { useState, useEffect } from "react";
import axios from "axios";
import { Modal, Button, Form, Table } from "react-bootstrap";
import Navbar from './Navbar';
const AdminUsers = () => {
	const [users, setUsers] = useState([]);
	const [showAddModal, setShowAddModal] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [selectedUser, setSelectedUser] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
	const [formData, setFormData] = useState({
		name: "",
		prenom: "",
		email: "",
		password: "",
		role: "employe",
	});

	// Récupérer les users
	const fetchUsers = async () => {
		try {
			const token = localStorage.getItem("token");
			const res = await axios.get("http://localhost:5000/api/auth/users", {
				headers: { Authorization: `Bearer ${token}` },
			});
			setUsers(res.data);
		} catch (error) {
			console.error("Erreur lors du chargement des utilisateurs :", error);
		}
	};

	useEffect(() => {
		fetchUsers();
	}, []);

	const handleChange = (e) => {
		setFormData({ ...formData, [e.target.name]: e.target.value });
	};

	const handleAddUser = async () => {
		try {
			const token = localStorage.getItem("token");
			await axios.post("http://localhost:5000/api/auth/register", formData, {
				headers: { Authorization: `Bearer ${token}` },
			});
			setShowAddModal(false);
			setFormData({
				name: "",
				prenom: "",
				email: "",
				password: "",
				role: "employe",
			});
			fetchUsers();
		} catch (error) {
			console.error("Erreur d'ajout :", error);
		}
	};

	const handleEditUser = (user) => {
		setSelectedUser(user);
		setFormData({
			name: user.name,
			prenom: user.prenom,
			email: user.email,
			password: "", // Vide pour éviter d’afficher le hash
			role: user.role,
		});
		setShowEditModal(true);
	};

	const handleUpdateUser = async () => {
		try {
			const token = localStorage.getItem("token");
            console.log(selectedUser.id);
			await axios.put(
				`http://localhost:5000/api/auth/users/${selectedUser.id}`,
				formData,
				{
					headers: { Authorization: `Bearer ${token}` },
				}
			);
			setShowEditModal(false);
			fetchUsers();
		} catch (error) {
			console.error("Erreur de mise à jour :", error);
		}
	};

    const handleDeleteClick = (user) => {
        setUserToDelete(user);
        setShowDeleteModal(true);
      };

      const handleDeleteUser = async () => {
        if (!userToDelete) return;
      
        try {
          const token = localStorage.getItem("token");
          await axios.delete(`http://localhost:5000/api/auth/users/${userToDelete.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          fetchUsers();
          setShowDeleteModal(false);
          setUserToDelete(null);
        } catch (error) {
          console.error("Erreur de suppression :", error);
        }
      };
      
	

	return (
		<div className="container-fluid mt-4">
			<Navbar />
			<Button variant="success" onClick={() => setShowAddModal(true)}>
				Ajouter un utilisateur
			</Button>

			<Table striped bordered hover className="mt-3">
				<thead>
					<tr>
						<th>Nom</th>
						<th>Prénom</th>
						<th>Email</th>
						<th>Rôle</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{users.map((user) => (
						<tr key={user.id}>
							<td>{user.name}</td>
							<td>{user.prenom}</td>
							<td>{user.email}</td>
							<td>{user.role}</td>
							<td>
								<Button
									variant="warning"
									size="sm"
									className="me-2"
									onClick={() => handleEditUser(user)}
								>
									Modifier
								</Button>
                                <Button variant="danger" size="sm" className="me-2" onClick={() => handleDeleteClick(user)}>Supprimer</Button>

							</td>
						</tr>
					))}
				</tbody>
			</Table>

			{/* Modal d'ajout */}
			<Modal show={showAddModal} onHide={() => setShowAddModal(false)}>
				<Modal.Header closeButton>
					<Modal.Title>Ajouter un utilisateur</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<Form>
						<Form.Group className="mb-2">
							<Form.Control
								type="text"
								placeholder="Nom"
								name="name"
								value={formData.name}
								onChange={handleChange}
							/>
						</Form.Group>
						<Form.Group className="mb-2">
							<Form.Control
								type="text"
								placeholder="Prénom"
								name="prenom"
								value={formData.prenom}
								onChange={handleChange}
							/>
						</Form.Group>
						<Form.Group className="mb-2">
							<Form.Control
								type="email"
								placeholder="Email"
								name="email"
								value={formData.email}
								onChange={handleChange}
							/>
						</Form.Group>
						<Form.Group className="mb-2">
							<Form.Control
								type="password"
								placeholder="Mot de passe"
								name="password"
								value={formData.password}
								onChange={handleChange}
							/>
						</Form.Group>
						<Form.Group className="mb-2">
							<Form.Select name="role" value={formData.role} onChange={handleChange}>
								<option value="admin">Administrateur</option>
								<option value="directeur">Directeur</option>
								<option value="chef">Chef de département</option>
								<option value="employe">Employé</option>
							</Form.Select>
						</Form.Group>
					</Form>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="secondary" onClick={() => setShowAddModal(false)}>
						Annuler
					</Button>
					<Button variant="success" onClick={handleAddUser}>
						Enregistrer
					</Button>
				</Modal.Footer>
			</Modal>

			{/* Modal de modification */}
			<Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
				<Modal.Header closeButton>
					<Modal.Title>Modifier l'utilisateur</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<Form>
						<Form.Group className="mb-2">
							<Form.Control
								type="text"
								name="name"
								value={formData.name}
								onChange={handleChange}
							/>
						</Form.Group>
						<Form.Group className="mb-2">
							<Form.Control
								type="text"
								name="prenom"
								value={formData.prenom}
								onChange={handleChange}
							/>
						</Form.Group>
						<Form.Group className="mb-2">
							<Form.Control
								type="email"
								name="email"
								value={formData.email}
								onChange={handleChange}
							/>
						</Form.Group>
						<Form.Group className="mb-2">
							<Form.Control
								type="password"
								name="password"
								placeholder="Nouveau mot de passe (facultatif)"
								value={formData.password}
								onChange={handleChange}
							/>
						</Form.Group>
						<Form.Group className="mb-2">
							<Form.Select name="role" value={formData.role} onChange={handleChange}>
								<option value="admin">Administrateur</option>
								<option value="directeur">Directeur</option>
								<option value="chef">Chef de département</option>
								<option value="employe">Employé</option>
							</Form.Select>
						</Form.Group>
					</Form>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="secondary" onClick={() => setShowEditModal(false)}>
						Annuler
					</Button>
					<Button variant="warning" onClick={handleUpdateUser}>
						Modifier
					</Button>
				</Modal.Footer>
			</Modal>

            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
  <Modal.Header closeButton>
    <Modal.Title>Confirmation de suppression</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    Êtes-vous sûr de vouloir supprimer l'utilisateur :
    <strong> {userToDelete?.name} {userToDelete?.prenom}</strong> ?
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
      Annuler
    </Button>
    <Button variant="danger" onClick={handleDeleteUser}>
      Oui, supprimer
    </Button>
  </Modal.Footer>
</Modal>

		</div>
	);
};

export default AdminUsers;
