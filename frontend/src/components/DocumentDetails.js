import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from './Navbar';
import { Container, Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const DocumentDetails = () => {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [showVersions, setShowVersions] = useState(false);
  const [oldVersions, setOldVersions] = useState([]);



  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/documents/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Échec du chargement du document");
        const doc = await res.json();
        setDocument(doc);
        setSelectedVersion(doc.version);
      } catch (error) {
        console.error("Erreur document :", error);
        setErrorMessage("Impossible de charger le document.");
      }
    };


    const fetchVersions = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/documents/versions/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Échec du chargement des versions");
        const versionList = await res.json();
        setVersions(versionList);
      } catch (error) {
        console.error("Erreur versions :", error);
      }
    };

    if (id && token) {
      fetchDocument();
      fetchVersions();
    }
  }, [id, token]);

  const handleVersionChange = async (e) => {
    const versionId = e.target.value;
    const selected = versions.find(v => v.id === parseInt(versionId));
    if (selected) {
      try {
        const res = await fetch(`http://localhost:5000/api/documents/version/${selected.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Échec du chargement de la version sélectionnée");
        const versionDoc = await res.json();
        setDocument(versionDoc);
        setSelectedVersion(versionDoc.version);
      } catch (error) {
        console.error("Erreur chargement version :", error);
      }
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleSummarize = async () => {
    if (!document || !document.text_content) {
      setSummary("⚠️ Le document ne contient pas de texte à résumer.");
      return;
    }

    setIsSummarizing(true);
    setSummary(null);

    try {
      const textToSummarize = document.text_content.length > 1000
        ? document.text_content.substring(0, 1000)
        : document.text_content;

      const summaryText = await generateSummary(textToSummarize);
      setSummary(summaryText);
    } catch (error) {
      setSummary("❌ Impossible de générer le résumé.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const generateSummary = async (text) => {
    try {
      const response = await axios.post("http://localhost:5000/api/summarize", { text });
      return response.data.summary;
    } catch (error) {
      console.error("Erreur lors de la génération du résumé:", error);
      return "❌ Une erreur est survenue avec l’API.";
    }
  };



  const renderDocumentViewer = () => {
    if (!document || !document.file_path) return null;

    const fileExtension = document.file_path.split('.').pop().toLowerCase();
    const fullUrl = `http://localhost:5000${document.file_path}`;

    if (['jpg', 'jpeg', 'png'].includes(fileExtension)) {
      return <img src={fullUrl} alt="document" style={{ width: '100%' }} />;
    } else if (fileExtension === 'pdf') {
      return (
        <iframe
          title="PDF Viewer"
          src={fullUrl}
          width="100%"
          height="100%"
          style={{ border: 'none', minHeight: '600px' }}
        ></iframe>
      );
    } else {
      return <Alert variant="warning">Format non supporté.</Alert>;
    }
  };

  const handleRequestAccess = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          message: `Demande d'accès aux anciennes versions du document #${id}`,
          type: 'request',
          related_task_id: null,
        }),
      });
  
      if (!res.ok) throw new Error("Erreur lors de la demande");
  
      alert("✅ Votre demande d'accès a été envoyée à l'administrateur.");
    } catch (error) {
      console.error("Erreur demande accès :", error);
      alert("❌ Une erreur est survenue lors de la demande.");
    }
  };
  

  // Décoder JWT pour récupérer userId
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      setUserId(decoded.id); // ici tu fixes le problème
    }
  }, []);

  useEffect(() => {
    fetch('http://localhost:5000/api/auth/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error('Erreur chargement utilisateurs :', err));
  }, []);

  // Associer userId au user courant
  useEffect(() => {
    if (userId && users.length > 0) {
      const found = users.find(u => u.id === userId);
      if (found) setCurrentUser(found);
    }
  }, [userId, users]);

  const fetchOldVersions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/document_versions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOldVersions(res.data);
    } catch (error) {
      console.error('Erreur lors de la récupération des anciennes versions:', error);
    }
  };
  const handleViewVersions = () => {
    navigate(`/document/${document.id}/versions`);
  };


  console.log("Liste des utilisateurs:", users);
  console.log("userId:", userId, "typeof:", typeof userId);
  console.log("users[0].id typeof:", typeof users[0]?.id);
  console.log("currentUser:", currentUser);
  console.log("Versions:", versions.length);

  return (
    <>
      <Navbar />
      <Container fluid className="px-4 py-3" style={{ minHeight: '100vh' }}>
        {errorMessage ? (
          <Alert variant="danger">{errorMessage}</Alert>
        ) : document ? (
          <Row style={{ height: '100%' }}>
            {/* Colonne gauche : visualisation du document */}
            <Col md={8}>
              <Card className="h-100">
                <Card.Header>📄 Aperçu du document</Card.Header>
                <Card.Body style={{ padding: 0 }}>{renderDocumentViewer()}</Card.Body>
              </Card>
            </Col>

            {/* Colonne droite : détails */}
            <Col md={4}>
              <Card className="h-100">
                <Card.Body>
                  <div className="d-flex justify-content-end">
                    <Button variant="secondary" size="sm" onClick={handleBack}>
                      ⬅️ Retour
                    </Button>
                  </div>

                  <h4 className="mt-3">📌 Détails</h4>
                  <p><strong>Nom :</strong> {document.name}</p>
                  <p><strong>Catégorie :</strong> {document.category}</p>
                  <p><strong>Collection :</strong> {document.collectionName || 'Aucune'}</p>
                  <p><strong>Date d’upload :</strong> {new Date(document.createdAt).toLocaleString()}</p>
                  <p><strong>Visibilité :</strong> {document.visibility}</p>

                  {document.version !== undefined && document.version !== null && (
                    <p className="mt-4">
                      <strong>ℹ️ Version actuelle :</strong> {document.version}
                      {document.version > 1 && currentUser?.role !== 'admin' && (
                        <Button
                          variant="warning"
                          className="mt-2"
                          onClick={handleRequestAccess}
                        >
                          🔒 Demander l'accès aux anciennes versions
                        </Button>
                      )}
                        {document.version > 1 && currentUser?.role === 'admin' && (
                      <button onClick={handleViewVersions}>Voir les versions</button>)}

                    </p>
                  )}

                  <Button variant="info" onClick={handleSummarize} disabled={isSummarizing}>
                    {isSummarizing ? "Résumé en cours..." : "🧠 Résumer ce document"}
                  </Button>

                  {summary && (
                    <Alert variant="light" className="mt-3">
                      <h6>📝 Résumé :</h6>
                      <p>{summary}</p>
                    </Alert>
                  )}
                  {versions.length > 0 && (
                    <Form.Group className="mt-4">
                      <Form.Label><strong>📑 Versions :</strong></Form.Label>
                      <Form.Select value={selectedVersion} onChange={handleVersionChange}>
                        {versions.map(v => (
                          <option key={v.id} value={v.id}>
                            Version {v.version} – {new Date(v.date).toLocaleDateString()}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        ) : (
          <p>Chargement du document...</p>
        )}
      </Container>
    </>
  );
};

export default DocumentDetails;
