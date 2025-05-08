import React, { useEffect, useState } from 'react';
import { Table, Card, Button, Badge, Form, Modal, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'react-toastify';
const ArchivePage = () => {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchArchives = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Aucun token d\'authentification trouvé');
      }
  
      const res = await axios.get('http://localhost:5000/api/workflows/archives', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
  
      setArchives(res.data);
    } catch (err) {
      console.error('Erreur:', err);
      
      // Gestion spécifique des erreurs 401 (Non autorisé)
      if (err.response?.status === 401) {
        localStorage.removeItem('token'); // Nettoyage du token invalide
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      } else {
        // Afficher un message d'erreur à l'utilisateur
        toast.error('Erreur lors du chargement des archives');
      }
    } finally {
      setLoading(false);
    }
  };

  // Dans votre useEffect
useEffect(() => {
    fetchArchives();
  }, []);

  const filteredArchives = archives.filter(archive =>
    archive.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    archive.document_id.toString().includes(searchTerm)
  );

  const downloadReport = (archive) => {
    const element = document.createElement('a');
    const file = new Blob([archive.validation_report], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `rapport_${archive.document_id}_${format(parseISO(archive.completed_at), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(element);
    element.click();
  };

  return (
    <div className="container-fluid py-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h4>Archives des Workflows</h4>
          <Form.Control
            type="search"
            placeholder="Rechercher..."
            style={{ width: '300px' }}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : (
            <Table striped hover responsive>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Workflow</th>
                  <th>Date d'achèvement</th>
                  <th>Rapport</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredArchives.map(archive => (
                  <tr key={archive.id}>
                    <td>DOC-{archive.document_id}</td>
                    <td>{archive.name}</td>
                    <td>
                      {format(parseISO(archive.completed_at), 'PP', { locale: fr })}
                    </td>
                    <td>
                      <Badge bg={archive.validation_report ? 'success' : 'secondary'}>
                        {archive.validation_report ? 'Disponible' : 'Aucun'}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => {
                          setSelectedArchive(archive);
                          setShowModal(true);
                        }}
                      >
                        Détails
                      </Button>
                      {archive.validation_report && (
                        <Button
                          variant="outline-success"
                          size="sm"
                          className="ms-2"
                          onClick={() => downloadReport(archive)}
                        >
                          Télécharger
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Modal de détails */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Détails de l'archive</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedArchive && (
            <div>
              <h5>{selectedArchive.name}</h5>
              <p>Document: DOC-{selectedArchive.document_id}</p>
              <p>Terminé le: {format(parseISO(selectedArchive.completed_at), 'PPpp', { locale: fr })}</p>
              
              <Card className="mt-3">
                <Card.Header>Rapport de validation</Card.Header>
                <Card.Body>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    {selectedArchive.validation_report || 'Aucun rapport disponible'}
                  </pre>
                </Card.Body>
              </Card>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Fermer
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ArchivePage;