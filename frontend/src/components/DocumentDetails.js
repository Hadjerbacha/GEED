import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from './Navbar';
import { Container, Row, Col, Card, Button, Form } from 'react-bootstrap';

const DocumentDetails = () => {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const token = localStorage.getItem('token');

  const fetchDocument = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
  
      if (!res.ok) {
        console.error('Erreur HTTP', res.status);
        return;
      }
  
      const data = await res.json();
      console.log('Document reçu :', data); // 👀 Regarde ce qu'on reçoit
      setDocument(data);
      setSelectedVersion(data.version);
    } catch (error) {
      console.error('Erreur lors du chargement du document :', error);
    }
  };
  

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/documents/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
  
        if (!res.ok) {
          console.error('Erreur HTTP', res.status);
          return;
        }
  
        const data = await res.json();
        console.log('📄 Document reçu :', data); // Ajoute ça
        setDocument(data);
        setSelectedVersion(data.version);
      } catch (error) {
        console.error('❌ Erreur chargement document :', error);
      }
    };
  
    fetchDocument();
  }, [id, token]);
  

    const fetchVersions = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/documents/versions/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const versionList = await res.json();
        setVersions(versionList);
      } catch (error) {
        console.error('Erreur lors du chargement des versions :', error);
      }
    };

    fetchDocument();
    fetchVersions();
  }, [id, token]);

  const handleVersionChange = (e) => {
    const versionId = e.target.value;
    const selected = versions.find(v => v.id === parseInt(versionId));
    setDocument(selected);
    setSelectedVersion(selected.version);
  };

  return (
    <>
      <Navbar />
      <Container className="mt-4">
        {document ? (
          <Card>
            <Card.Header>
              <h4>{document.name} (Version {document.version})</h4>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <p><strong>Catégorie :</strong> {document.category}</p>
                  <p><strong>Collection :</strong> {document.collectionName || 'Non définie'}</p>
                  <p><strong>Date :</strong> {new Date(document.date).toLocaleString()}</p>
                  <Button
                    variant="primary"
                    onClick={() => window.open(`http://localhost:5000${document.file_path}`, '_blank')}
                  >
                    Ouvrir le fichier
                  </Button>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Autres versions :</Form.Label>
                    <Form.Select value={selectedVersion} onChange={handleVersionChange}>
                      {versions.map(v => (
                        <option key={v.id} value={v.id}>
                          Version {v.version} - {new Date(v.date).toLocaleDateString()}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
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
