import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom'; // ⬅️ Ajout de useNavigate
import { Form, Button, Card, Alert } from 'react-bootstrap';

const DetailsTask = () => {
  const { id } = useParams();
  const navigate = useNavigate(); // ⬅️ Hook pour la navigation
  const [task, setTask] = useState(null);
  const [comment, setComment] = useState('');
  const [responseFile, setResponseFile] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/tasks/mes-taches', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const taskData = response.data.find(t => t.id.toString() === id);
        if (taskData) {
          setTask(taskData);
          setComment(taskData.assignment_note || '');
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des tâches :', error);
      }
    };

    fetchTask();
  }, [id, token]);

  const handleCommentChange = (e) => setComment(e.target.value);
  const handleFileChange = (e) => setResponseFile(e.target.files[0]);

  const handleUpdate = async () => {
    try {
      await axios.patch(`http://localhost:5000/api/tasks/${id}/comment`, {
        assignment_note: comment
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (responseFile) {
        const formData = new FormData();
        formData.append('fichier', responseFile);
        formData.append('task_id', id);

        await axios.post('http://localhost:5000/api/documents/reponse', formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      setSuccessMessage('Mise à jour réussie !');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Erreur lors de la mise à jour :', error);
      alert('Erreur lors de la mise à jour.');
    }
  };

  if (!task) return <p>Chargement...</p>;

  const renderStatus = (status) => {
    switch (status) {
      case 'pending':
        return '⏳ En attente';
      case 'assigned':
        return '📌 Assignée';
      case 'in_progress':
        return '🔧 En cours';
      case 'completed':
        return '✅ Terminée';
      default:
        return status;
    }
  };
  
  return (
    <div className="d-flex justify-content-center align-items-center m-4" style={{ minHeight: '90vh' }}>
      <Card className="shadow" style={{ width: '60%', maxWidth: '900px' }}>
        <Card.Body>
          <h3 className="mb-3">{task.title}</h3>
          <hr/>
          <p><strong>Description :</strong> {task.description}</p>
          <p><strong>Date limite :</strong> {task.due_date}</p>
          <p><strong>Priorité :</strong> {task.priority}</p>
          <p><strong>Statut :</strong> {renderStatus(task.status)}</p>
          <p><strong>Créée le :</strong> {new Date(task.created_at).toLocaleString()}</p>
          <hr />

          <h5>Fichiers liés :</h5>
          <ul>
            {task.file_path && (
              <li>
                <a href={`http://localhost:5000/${task.file_path}`} target="_blank" rel="noreferrer">
  Fichier
</a>

              </li>
            )}
          </ul>

          <hr />

          <Form.Group>
            <Form.Label><strong>Commentaire :</strong></Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={comment}
              onChange={handleCommentChange}
            />
          </Form.Group>

          <Form.Group className="mt-3">
            <Form.Label>Fichier de réponse :</Form.Label>
            <Form.Control type="file" onChange={handleFileChange} />
          </Form.Group>

          {successMessage && <Alert variant="success" className="mt-3">{successMessage}</Alert>}

          <div className="d-flex justify-content-between mt-4">
            <Button variant="secondary" onClick={() => navigate('/mes-taches')}>
              ⬅️ Retour
            </Button>

            <Button variant="primary" onClick={handleUpdate}>
              Mettre à jour
            </Button>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default DetailsTask;
