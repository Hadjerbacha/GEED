import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container, Row, Col, Button, Form, Table, Alert, Accordion, Card, Modal
} from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import Navbar from './Navbar';
import { useNavigate } from 'react-router-dom';

const Doc = () => {
  const [documents, setDocuments] = useState([]);
  const [groupedDocs, setGroupedDocs] = useState({});
  const [collections, setCollections] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [uploadData, setUploadData] = useState({ collectionName: '', file: null });
  const [newFolderName, setNewFolderName] = useState('');
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  const headers = { Authorization: `Bearer ${token}` };

  // 📥 Charger documents et collections
  useEffect(() => {
    fetchDocuments();
    fetchCollections();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/documents/', { headers });
      if (Array.isArray(res.data)) {
        setDocuments(res.data);
      } else {
        setErrorMessage('Format de données invalide.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Erreur chargement documents.");
    }
  };

  const fetchCollections = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/collections/', { headers });
      setCollections(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // 📁 Regrouper les documents par dossier et version
  useEffect(() => {
    const grouped = {};
    documents.forEach(doc => {
      const folder = doc.collectionName || 'Sans dossier';
      const baseName = doc.name;
      if (!grouped[folder]) grouped[folder] = {};
      if (!grouped[folder][baseName]) grouped[folder][baseName] = [];
      grouped[folder][baseName].push(doc);
    });

    for (const folder in grouped) {
      for (const baseName in grouped[folder]) {
        grouped[folder][baseName].sort((a, b) => b.version - a.version);
      }
    }

    setGroupedDocs(grouped);
  }, [documents]);

  // 📤 Uploader un document
  const handleUpload = async () => {
    if (!uploadData.collectionName || !uploadData.file) return;

    const formData = new FormData();
    formData.append('file', uploadData.file);
    formData.append('collectionName', uploadData.collectionName);

    try {
      await axios.post('http://localhost:5000/api/documents/', formData, { headers });
      setShowUploadModal(false);
      setUploadData({ collectionName: '', file: null });
      fetchDocuments();
    } catch (err) {
      console.error(err);
      setErrorMessage("Erreur lors de l’upload.");
    }
  };

  // 📁 Créer un nouveau dossier
  const handleCreateFolder = async () => {
    if (!newFolderName) return;
    try {
      await axios.post('http://localhost:5000/api/collections/', { name: newFolderName }, { headers });
      setNewFolderName('');
      setShowFolderModal(false);
      fetchCollections();
    } catch (err) {
      console.error(err);
      setErrorMessage("Erreur création dossier.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce document ?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/documents/${id}`, { headers });
      fetchDocuments();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <Navbar />
      <Container fluid className="my-4">
        <Row className="mb-3">
          <Col className="text-end">
            <Button variant="success" onClick={() => setShowFolderModal(true)}>➕ Nouveau dossier</Button>{' '}
            <Button variant="primary" onClick={() => setShowUploadModal(true)}>⬆️ Ajouter document</Button>
          </Col>
        </Row>

        {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

        <Accordion defaultActiveKey="0">
          {Object.entries(groupedDocs).map(([collectionName, docsByName], idx) => (
            <Card key={collectionName}>
              <Accordion.Item eventKey={idx.toString()}>
                <Accordion.Header>📁 {collectionName}</Accordion.Header>
                <Accordion.Body>
                  {Object.entries(docsByName).map(([docName, versions]) => (
                    <div key={docName} className="mb-4">
                      <h5>{docName}</h5>
                      <Table striped bordered hover responsive>
                        <thead>
                          <tr>
                            <th>Version</th>
                            <th>Date</th>
                            <th>Catégorie</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {versions.map(doc => (
                            <tr key={doc.id}>
                              <td>{doc.version}</td>
                              <td>{doc.date ? new Date(doc.date).toLocaleString() : 'N/A'}</td>
                              <td>{doc.category || 'N/A'}</td>
                              <td>
                                <Button size="sm" variant="primary" onClick={() => window.open(`http://localhost:5000${doc.file_path}`, '_blank')}>Ouvrir</Button>{' '}
                                <Button size="sm" variant="info" onClick={() => navigate(`/documents/${doc.id}`)}>Détails</Button>{' '}
                                <Button size="sm" variant="danger" onClick={() => handleDelete(doc.id)}>Supprimer</Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  ))}
                </Accordion.Body>
              </Accordion.Item>
            </Card>
          ))}
        </Accordion>
      </Container>

      {/* Modal Upload */}
      <Modal show={showUploadModal} onHide={() => setShowUploadModal(false)}  style={{ zIndex: 1050, width: '100%' }}
  backdrop="static"
  centered>
        <Modal.Header closeButton>
          <Modal.Title>📄 Ajouter un document</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Dossier</Form.Label>
            <Form.Select value={uploadData.collectionName} onChange={e => setUploadData({ ...uploadData, collectionName: e.target.value })}>
              <option value="">-- Choisir un dossier --</option>
              {collections.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Fichier</Form.Label>
            <Form.Control type="file" onChange={e => setUploadData({ ...uploadData, file: e.target.files[0] })} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowUploadModal(false)}>Annuler</Button>
          <Button variant="primary" onClick={handleUpload}>Uploader</Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Nouveau dossier */}
      <Modal show={showFolderModal} onHide={() => setShowFolderModal(false)}  style={{ zIndex: 1050, width: '100%' }}
  backdrop="static"
  centered>
        <Modal.Header closeButton>
          <Modal.Title>Créer un dossier</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Nom du dossier</Form.Label>
            <Form.Control
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Ex: RH, Finances, Juridique"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowFolderModal(false)}>Annuler</Button>
          <Button variant="success" onClick={handleCreateFolder}>Créer</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Doc;
