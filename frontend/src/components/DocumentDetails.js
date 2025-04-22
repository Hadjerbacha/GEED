import React, { useEffect, useState } from 'react';
import Navbar from './Navbar';
import { Container, Row, Col, Card, Button, Form } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom'; 


const DocumentDetails = () => {
  const { id } = useParams(); // Récupérer l'ID du document depuis l'URL
  const [document, setDocument] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const token = localStorage.getItem('token'); // Récupérer le token pour l'authentification
  const [errorMessage, setErrorMessage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Supprime les appels API pour l'instant
    const fakeDocument = {
      name: "Rapport Technique - Projet GED",
      category: "Technique",
      collectionName: "Projets Internes",
      createdAt: new Date(),
      visibility: "Privé",
      text_content: "Voici le contenu extrait du document pour test d'affichage...",
      version: 1
    };

    const fakeVersions = [
      { id: 1, version: 1, date: new Date() },
      { id: 2, version: 2, date: new Date() }
    ];

    setDocument(fakeDocument);
    setVersions(fakeVersions);
    setSelectedVersion(1);
  }, []);

  /*
      const fetchVersions = async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/documents/versions/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const versionList = await res.json();
          setVersions(versionList); // Enregistrer la liste des versions du document
        } catch (error) {
          console.error('Erreur lors du chargement des versions :', error);
        }
      };
  
      fetchDocument();
      fetchVersions();
  
    }, [id, token]); // Refait un appel si l'ID ou le token change
  */
  const handleVersionChange = (e) => {
    const versionId = e.target.value;
    const selected = versions.find(v => v.id === parseInt(versionId));
    setDocument(selected); // Mettre à jour les données du document selon la version choisie
    setSelectedVersion(selected.version);
  };

  const handleBack = () => {
    navigate('/documents'); // Redirige vers la liste des documents
  };

  return (
    <>
      <Navbar /> {/* Affichage de la barre de navigation */}
      <Container className="mt-4 d-flex justify-content-center">
        {document ? (
          <Card className="shadow p-4" style={{ width: '100%', maxWidth: '700px' }}>
            <Card.Body>
               {/* 🔙 Bouton Retour */}
               <div className="mt-4 text-end">
                <Button variant="secondary" onClick={handleBack}>
                  ⬅️ Revenir aux documents
                </Button>
              </div>
              <h3 className="mb-4 d-flex align-items-center justify-content-between">
                <span>📄 Détails du document</span>
                <a
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-primary btn-sm"
                >
                  🔍 Voir le document
                </a>
              </h3>


              <p><strong>📌 Nom :</strong> {document.name}</p>
              <p><strong>📂 Catégorie :</strong> {document.category}</p>
              <p><strong>📚 Collection :</strong> {document.collectionName || 'Aucune'}</p>
              <p><strong>📅 Date d’upload :</strong> {new Date(document.createdAt).toLocaleString()}</p>
              <p><strong>🔐 Visibilité :</strong> {document.visibility}</p>

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

              {versions && versions.length > 0 && (
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
