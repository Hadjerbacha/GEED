import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from './Navbar';
import { Container, Row, Col, Card, Button, Form } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';

const DocumentDetails = () => {
  const { id } = useParams(); // ID du document depuis l'URL

  console.log("🧾 ID reçu dans l’URL :", id);

  const [document, setDocument] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [socket, setSocket] = useState(null);

  

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

    
const testAxios = async () => {
  try {
    const response = await axios.post(
      "https://jsonplaceholder.typicode.com/posts", 
      { title: "test", body: "This is a test", userId: 1 }
    );
    console.log("Réponse:", response);
  } catch (error) {
    console.error("Erreur Axios:", error);
  }
};

testAxios();




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
    navigate('/documents');
  };

  
  

  const handleSummarize = async () => {
    if (!document || !document.text_content) {
      setSummary("⚠️ Le document ne contient pas de texte à résumer.");
      return;
    }
  
    setIsSummarizing(true);
    setSummary(null);
  
    try {
      // Limiter le texte à 1000 caractères pour éviter un échec dû à une taille trop grande
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
      const response = await axios.post("http://localhost:5000/api/summarize", {
        text
      });
  
      return response.data.summary;
    } catch (error) {
      console.error("Erreur lors de la génération du résumé:", error);
      return "❌ Une erreur est survenue avec l’API Google.";
    }
  };
  


  return (
    <>
      <Navbar />
      <Container className="mt-4 d-flex justify-content-center">
        {errorMessage ? (
          <p className="text-danger">{errorMessage}</p>
        ) : document ? (
          <Card className="shadow p-4" style={{ width: '100%', maxWidth: '700px' }}>
            <Card.Body>
              <div className="mt-4 text-end">
                <Button variant="secondary" onClick={handleBack}>
                  ⬅️ Revenir aux documents
                </Button>

              </div>
              <Button
                variant="outline-primary"
                size="sm"
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2"
              >
                🔍 Voir le document
              </Button>

              <h3 className="mb-4 d-flex align-items-center justify-content-between">
                <span>📄 Détails du document</span>
                {document.url && (
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline-primary btn-sm"
                  >
                    🔍 Voir le document
                  </a>
                )}
              </h3>

              <p><strong>📌 Nom :</strong> {document.name}</p>
              <p><strong>📂 Catégorie :</strong> {document.category}</p>
              <p><strong>📚 Collection :</strong> {document.collectionName || 'Aucune'}</p>
              <p><strong>📅 Date d’upload :</strong> {new Date(document.createdAt).toLocaleString()}</p>
              <p><strong>🔐 Visibilité :</strong> {document.visibility}</p>

              <div className="mt-3">
                <Button variant="info" onClick={handleSummarize} disabled={isSummarizing}>
                  {isSummarizing ? "Résumé en cours..." : "🧠 Résumer ce document"}
                </Button>
                {summary && (
                  <div className="bg-white border rounded p-3 mt-3">
                    <h5>📝 Résumé généré :</h5>
                    <p>{summary}</p>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <p><strong>🧠 Contenu extrait :</strong></p>
                <div className="bg-light border rounded p-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {document.text_content ? (
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{document.text_content}</pre>
                  ) : (
                    <em>Pas de contenu extrait disponible</em>
                  )}
                </div>
              </div>

              {versions.length > 0 && (
                <Form.Group className="mt-4">
                  <Form.Label><strong>📑 Autres versions :</strong></Form.Label>
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
        ) : (
          <p>Chargement du document...</p>
        )}
      </Container>
    </>
  );
};

export default DocumentDetails;
