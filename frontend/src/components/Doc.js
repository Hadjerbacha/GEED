import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Row, Col, Button, Form, Table, Alert, InputGroup, FormControl, Modal } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import Navbar from './Navbar'; // Assurez-vous d'avoir un composant Navbar

const Doc = () => {
  const [documents, setDocuments] = useState([]);
  const [savedDocuments, setSavedDocuments] = useState([]);
  const [pendingName, setPendingName] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('Tous les documents');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [useAdvancedFilter, setUseAdvancedFilter] = useState(false);
  const [category, setCategory] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [collections, setCollections] = useState([]);
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [selectedExistingCollection, setSelectedExistingCollection] = useState('');

  const [showConflictPrompt, setShowConflictPrompt] = useState(false);
  const [conflictingDocName, setConflictingDocName] = useState('');
  const [forceUpload, setForceUpload] = useState(false);

  const token = localStorage.getItem('token');

  const fetchDocuments = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/documents/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) throw new Error('Non autorisé');
      const data = await res.json();
      if (Array.isArray(data)) {
        setDocuments(data);
        const names = data.map(doc => doc.collectionName).filter(name => name && typeof name === 'string');
        setCollections([...new Set(names)]);
      } else {
        console.error('Données invalides :', data);
        setDocuments([]);
        setCollections([]);
      }
    } catch (err) {
      console.error('Erreur chargement documents :', err);
      setErrorMessage("Erreur d'autorisation ou de connexion.");
    }
  };

  useEffect(() => { fetchDocuments(); }, [token]);

  const consultDocument = url => window.open(`http://localhost:5000${url}`, '_blank');

  const handleDelete = async id => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;
    try {
      await fetch(`http://localhost:5000/api/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(docs => docs.filter(d => d.id !== id));
      setSavedDocuments(docs => docs.filter(d => d.id !== id));
    } catch (err) {
      console.error('Erreur suppression :', err);
    }
  };

  const toggleSaveDocument = doc => {
    const exists = savedDocuments.some(d => d.id === doc.id);
    setSavedDocuments(exists ? savedDocuments.filter(d => d.id !== doc.id) : [...savedDocuments, doc]);
    setIsSavingCollection(true);
  };

  const handleUpload = async () => {
    if (!pendingFile || !pendingName || !category) {
      setErrorMessage('Veuillez remplir tous les champs requis.');
      return;
    }
    const existingDoc = documents.find(d => d.name === pendingName);
    if (existingDoc && !forceUpload) {
      setConflictingDocName(pendingName);
      setShowConflictPrompt(true);
      return;
    }
    if (pendingFile.size > 10 * 1024 * 1024) {
      setErrorMessage('Le fichier dépasse la limite de 10 Mo.');
      return;
    }
    const formData = new FormData();
    formData.append('name', pendingName);
    formData.append('file', pendingFile);
    formData.append('category', category);
    formData.append('collectionName', collectionName);
    if (forceUpload) formData.append('isNewVersion', 'true');

    try {
      const res = await fetch('http://localhost:5000/api/documents/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) throw new Error(`Erreur : ${res.status}`);
      const newDoc = await res.json();
      setDocuments([newDoc, ...documents]);
      setPendingFile(null);
      setPendingName('');
      setCategory('');
      setCollectionName('');
      setForceUpload(false);
      setShowConflictPrompt(false);
      setConflictingDocName('');
      setErrorMessage(null);
    } catch (err) {
      console.error('Erreur upload :', err);
      setErrorMessage("Erreur lors de l'envoi du document.");
    }
  };

  const saveCollection = async () => {
    const nameToUse = selectedExistingCollection || collectionName;
    if (!nameToUse) {
      setErrorMessage('Veuillez choisir ou entrer un nom de collection.');
      return;
    }
    try {
      const updated = await Promise.all(
        savedDocuments.map(async doc => {
          const res = await axios.put(
            `http://localhost:5000/api/documents/${doc.id}`,
            { collectionName: nameToUse },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          return res.data;
        })
      );
      setDocuments(prev => prev.map(d => updated.find(u => u.id === d.id) || d));
      setSavedDocuments([]);
      setCollectionName('');
      setSelectedExistingCollection('');
      setIsSavingCollection(false);
      if (!collections.includes(nameToUse)) setCollections([...collections, nameToUse]);
    } catch (err) {
      console.error('Erreur sauvegarde collection :', err);
      setErrorMessage('Erreur lors de la sauvegarde des documents.');
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const docName = doc.name || '';
    const docDate = doc.date ? new Date(doc.date) : null;
    const matchesType = filterType === 'Tous les documents' || docName.endsWith(filterType);
    const matchesDate = (!startDate || docDate >= new Date(startDate)) && (!endDate || docDate <= new Date(endDate));
    const matchesSearch = docName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAdvanced = useAdvancedFilter && (doc.text_content || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesDate && (matchesSearch || matchesAdvanced);
  });

  return (
    <>
      <Navbar />
      <div className="container-fluid">

        <Row className="my-3">
          <Col md={4}><Form.Control type="text" placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></Col>
          <Col md={2}><Form.Select value={filterType} onChange={e => setFilterType(e.target.value)}><option value="Tous les documents">Tous</option><option value=".pdf">PDF</option><option value=".docx">Word</option><option value=".jpg">Images</option></Form.Select></Col>
          <Col md={2}><Form.Control type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Col>
          <Col md={2}><Form.Control type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></Col>
          <Col md={2}><Button variant={useAdvancedFilter ? 'danger' : 'secondary'} onClick={() => setUseAdvancedFilter(!useAdvancedFilter)}>{useAdvancedFilter ? 'Désactiver Avancé' : 'Recherche Avancée'}</Button></Col>
        </Row>

        {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

        <Row className="mb-4">
          <Col md={3}><Form.Control type="text" placeholder="Nom du document" value={pendingName} onChange={e => setPendingName(e.target.value)} /></Col>
          <Col md={3}><Form.Control type="file" onChange={e => setPendingFile(e.target.files[0])} accept=".pdf,.docx,.jpg,.jpeg,.png" /></Col>
          <Col md={3}><Form.Select value={category} onChange={e => setCategory(e.target.value)}><option value="">Catégorie</option><option value="rapport">Rapport</option><option value="article">Article</option><option value="mémoire">Mémoire</option><option value="autre">Autre</option></Form.Select></Col>
          <Col md={3}><Button onClick={handleUpload}>Uploader</Button></Col>
        </Row>

        <Modal show={showConflictPrompt} onHide={() => setShowConflictPrompt(false)}>
          <Modal.Header closeButton><Modal.Title>Conflit de version</Modal.Title></Modal.Header>
          <Modal.Body>Un fichier nommé <strong>{conflictingDocName}</strong> existe déjà. Enregistrer une nouvelle version ?</Modal.Body>
          <Modal.Footer>
            <Button variant="primary" onClick={() => { setForceUpload(true); handleUpload(); }}>Oui</Button>
            <Button variant="secondary" onClick={() => setShowConflictPrompt(false)}>Non</Button>
          </Modal.Footer>
        </Modal>

        {isSavingCollection && savedDocuments.length > 0 && (
          <div className="my-4">
            <h4>📁 Ma Collection</h4>
            <Row>
              <Col md={4}><Form.Select value={selectedExistingCollection} onChange={e => setSelectedExistingCollection(e.target.value)}><option value="">Collection existante</option>{collections.map(col => <option key={col}>{col}</option>)}</Form.Select></Col>
              <Col md={4}><Form.Control type="text" placeholder="Ou entrer un nom..." value={collectionName} onChange={e => setCollectionName(e.target.value)} /></Col>
              <Col md={4}><Button onClick={saveCollection}>Sauvegarder</Button></Col>
            </Row>
            <ul className="mt-2">
              {savedDocuments.map(doc => (
                <li key={doc.id}>{doc.name} - {doc.category} <Button size="sm" variant="danger" onClick={() => toggleSaveDocument(doc)}>❌</Button></li>
              ))}
            </ul>
          </div>
        )}

        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Document</th>
              <th>Date</th>
              <th>Catégorie</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocuments.length > 0 ? filteredDocuments.map(doc => (
              <tr key={doc.id}>
                <td>{doc.name} {doc.version && `(version ${doc.version})`}</td>
                <td>{doc.date ? new Date(doc.date).toLocaleString() : 'Inconnue'}</td>
                <td>{doc.category || 'Non spécifiée'}</td>
                <td>
                  <Button size="sm" variant="info" onClick={() => consultDocument(doc.file_path)}>Consulter</Button>{' '}
                  <Button size="sm" variant="danger" onClick={() => handleDelete(doc.id)}>Supprimer</Button>{' '}
                  <Button size="sm" variant="success" onClick={() => toggleSaveDocument(doc)}>
                    {savedDocuments.some(d => d.id === doc.id) ? 'Retirer' : 'Save'}
                  </Button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="4" className="text-center">Aucun document trouvé</td></tr>
            )}
          </tbody>
        </Table>
      </div>
    </>
  );
};

export default Doc;