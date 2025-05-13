import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Spinner, Tooltip, OverlayTrigger, Container, Row, Col, Button, Form, Table, Alert, InputGroup, FormControl, Modal } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import Navbar from './Navbar';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import 'react-toastify/dist/ReactToastify.css';
import shareIcon from './img/share.png';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';
import { FaCloudUploadAlt } from 'react-icons/fa';
import Tesseract from 'tesseract.js';
import { getDocument } from 'pdfjs-dist/webpack'; // Importer getDocument depuis pdfjs-dist




const Doc = () => {
  const [errorMessage, setErrorMessage] = useState('');
  const [documents, setDocuments] = useState([]);
  const [savedDocuments, setSavedDocuments] = useState([]);
  const [pendingName, setPendingName] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('Tous les documents');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [useAdvancedFilter, setUseAdvancedFilter] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collections, setCollections] = useState([]);
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [selectedExistingCollection, setSelectedExistingCollection] = useState('');
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [description, setDescription] = useState('');
  const [showConflictPrompt, setShowConflictPrompt] = useState(false);
  const [conflictingDocName, setConflictingDocName] = useState('');
  const [forceUpload, setForceUpload] = useState(false);
  const [tags, setTags] = useState([]);
  const [priority, setPriority] = useState('');
  const [accessType, setAccessType] = useState('private');
  const [showShareModal, setShowShareModal] = useState(false);
  const [docToShare, setDocToShare] = useState(null);
  const [shareAccessType, setShareAccessType] = useState('private');
  const [shareUsers, setShareUsers] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [modalDoc, setModalDoc] = useState(null);
  const [autoWfName, setAutoWfName] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [existingWorkflow, setExistingWorkflow] = useState(null);
  const categories = ['Contrat', 'Mémoire', 'Article', 'Rapport'];
  const [selectedCategory, setSelectedCategory] = useState('');
  const [summary, setSummary] = useState('');
  const [access, setAccess] = useState('private');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);



  const [formData, setFormData] = useState({
    documentName: '',
    category: '',
    file: null,
    accessType: 'private',
    users: [],
  });

  const token = localStorage.getItem('token');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);

// Ajoutez ce state en haut du composant
const [userRole, setUserRole] = useState('');

// Modifiez le useEffect pour récupérer le rôle
useEffect(() => {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const { id, role } = jwtDecode(token);
      setUserId(id);
      setUserRole(role);
    } catch (e) {
      console.error('Token invalide:', e);
    }
  }
}, []);

  const openShareModal = (doc) => {
    setDocToShare(doc);
    setShareAccessType(doc.access || 'private');
    setShareUsers(doc.allowedUsers || []);
    setShowShareModal(true);
  };

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
        console.error('Données invalides:', data);
        setDocuments([]);
        setCollections([]);
      }
    } catch (err) {
      console.error('Erreur chargement documents:', err);
      setErrorMessage("Erreur d'autorisation ou de connexion.");
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/auth/users/');
      const formatted = res.data.map(u => ({ value: u.id, label: `${u.name} ${u.prenom}` }));
      setUsers(formatted);
      setAllUsers(formatted);
    } catch (err) {
      console.error('Erreur chargement des utilisateurs', err);
    }
  };

  const consultDocument = url => {
    window.open(`http://localhost:5000${url}`, '_blank');
  };

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
      console.error('Erreur suppression:', err);
    }
  };

  const handleUpload = async () => {
    if (!pendingFile || !pendingName) {
      setErrorMessage('Veuillez remplir tous les champs requis.');
      return;
    }

    let extractedText = '';

    try {
      // Vérifier si le fichier est une image ou un PDF
      if (pendingFile.type.startsWith('image/')) {
        // Si c'est une image, applique l'OCR
        const imageUrl = URL.createObjectURL(pendingFile);
        const result = await Tesseract.recognize(imageUrl, 'eng', {
          logger: m => console.log(m), // Pour le debug
        });
        extractedText = result.data.text;
        console.log('Texte OCR extrait de l\'image :', extractedText);
      } else if (pendingFile.type === 'application/pdf') {
        // Si c'est un PDF, extraire les pages et appliquer l'OCR sur chaque image
        extractedText = await processPDFOCR(pendingFile);
      } else {
        setErrorMessage('Fichier non supporté.');
        return;
      }

      // Vérifier si un document avec ce contenu existe déjà
      const existingContent = documents.find(d => d.text_content === extractedText);
      if (existingContent && !forceUpload) {
        setErrorMessage('Un document avec un contenu similaire existe déjà.');
        return; // Stop ici si doublon de contenu
      }

    } catch (ocrErr) {
      console.error('Erreur OCR :', ocrErr);
      setErrorMessage("Erreur pendant l'extraction du texte via OCR.");
      return;
    }

    // Vérifier si le nom du fichier existe déjà
    const existingDoc = documents.find(d => d.name === pendingName);
    if (existingDoc && !forceUpload) {
      setConflictingDocName(pendingName);
      setShowConflictPrompt(true);
      return;
    }

    // Vérifier la taille du fichier
    if (pendingFile.size > 10 * 1024 * 1024) {
      setErrorMessage('Le fichier dépasse la limite de 10 Mo.');
      return;
    }

    // Si tout est bon, procéder à l'upload du document
    await uploadNewDocument(extractedText);
  };

  // Fonction pour traiter un PDF et extraire le texte de ses pages
  const processPDFOCR = async (pdfFile) => {
    let extractedText = '';
    try {
      const pdfUrl = URL.createObjectURL(pdfFile);
      const pdf = await getDocument(pdfUrl).promise;  // Utiliser getDocument
      // Extraire les pages en images et appliquer l'OCR sur chaque image
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        // Appliquer l'OCR sur l'image de la page
        const result = await Tesseract.recognize(canvas.toDataURL(), 'eng', {
          logger: m => console.log(m),
        });

        extractedText += result.data.text;
        console.log(`Texte OCR extrait de la page ${pageNum}:`, result.data.text);
      }
    } catch (ocrErr) {
      console.error('Erreur OCR sur le PDF :', ocrErr);
      setErrorMessage("Erreur pendant l'extraction du texte via OCR.");
      return '';
    }
    return extractedText;
  };

  // Fonction pour l'upload du document
  const uploadNewDocument = async (extractedText) => {
    const formData = new FormData();
    formData.append('name', pendingName);
    formData.append('file', pendingFile);
    formData.append('text_content', extractedText);
    formData.append('summary', description);
    formData.append('tags', tags);
    formData.append('access', accessType);
    formData.append('prio', priority);

    if (access === 'custom') {
      selectedUsers.forEach(userId => formData.append('allowedUsers[]', userId));
    }

    try {
      const res = await axios.post('http://localhost:5000/api/documents/', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent); // ← ici tu mets à jour l'état
        },
      });

      const newDoc = res.data;
      setDocuments([newDoc, ...documents]);

      // Reset
      setPendingFile(null);
      setPendingName('');
      setUploadProgress(0); // reset la barre
      setErrorMessage(null);
      setConflictingDocName('');
      setShowConflictPrompt(false);
    } catch (err) {
      console.error('Erreur lors de l\'upload du document:', err);
      setErrorMessage(err.response?.data?.error || 'Erreur lors de l\'envoi du document.');
      setUploadProgress(0);
    }
  };

  const uploadNewVersion = async (documentId) => {
    const formData = new FormData();
    formData.append('file', pendingFile);
    formData.append('documentId', documentId);
    formData.append('collectionName', collectionName);
    formData.append('description', description);
    formData.append('priority', priority);
    formData.append('tags', JSON.stringify(tags));

    try {
      const res = await fetch(`http://localhost:5000/api/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur inconnue");

      alert("Nouvelle version ajoutée !");
      setForceUpload(false);
      setShowConflictPrompt(false);
      resetForm();
    } catch (err) {
      console.error('Erreur sauvegarde collection:', err);
      setErrorMessage('Erreur lors de la sauvegarde des documents.');
      setErrorMessage(err.message || 'Erreur lors de l\'ajout de la version.');
    }
  };

  const resetForm = () => {
    setPendingFile(null);
    setPendingName('');
    setCollectionName('');
    setErrorMessage(null);
    setConflictingDocName('');
  };

  const saveCollection = async () => {
    const nameToUse = selectedExistingCollection || collectionName;
    if (!nameToUse) {
      setErrorMessage('Veuillez choisir ou entrer un nom de collection.');
      return;
    }
    // Implémentation à compléter
  };

  // Étape 1 : Garder seulement la dernière version pour chaque nom de document
  const latestVersionsMap = new Map();

  documents.forEach(doc => {
    const existing = latestVersionsMap.get(doc.name);
    if (!existing || doc.version > existing.version) {
      latestVersionsMap.set(doc.name, doc);
    }
  });

  const latestDocuments = Array.from(latestVersionsMap.values());

  // Étape 2 : Appliquer les filtres existants sur ces derniers documents
  const filteredDocuments = latestDocuments.filter(doc => {
    const docName = doc.name || '';
    const docFilePath = doc.file_path || ''; // Utilisation de file_path pour extraire l'extension
    const docDate = doc.date ? new Date(doc.date) : null;
    const docContent = doc.text_content || '';
    const docCategory = doc.category || '';
    const docSummary = doc.summary || '';
    const docDescription = doc.description || ''; // Ajout description
    const docTags = Array.isArray(doc.tags) ? doc.tags : [];
    const docFolder = doc.folder || ''; // Si tu as un dossier associé au document
    const docAuthor = doc.author || ''; // Si tu as un auteur associé au document

    // Extraire l'extension du fichier à partir du chemin complet
    const fileExtension = docFilePath.split('.').pop().toLowerCase(); // Extraire l'extension du fichier depuis le chemin

    // Filtrer selon le type du document (extension)
    const matchesType = filterType === 'Tous les documents' ||
      fileExtension === filterType.toLowerCase();  // Comparer sans le point dans filterType

    const matchesDate = (!startDate || docDate >= new Date(startDate)) && (!endDate || docDate <= new Date(endDate));

    // Recherche avancée avec ajout de la description et d'autres champs possibles
    const matchesSearch = useAdvancedFilter
      ? (
        docContent.toLowerCase().includes(searchQuery.toLowerCase()) ||
        docSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        docDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||  // Recherche dans la description
        docFolder.toLowerCase().includes(searchQuery.toLowerCase()) ||  // Recherche dans le dossier
        docAuthor.toLowerCase().includes(searchQuery.toLowerCase()) ||  // Recherche dans l'auteur
        docTags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      : docName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === '' ||
      (doc.category && doc.category.toLowerCase() === selectedCategory.toLowerCase());

    return matchesType && matchesDate && matchesSearch && matchesCategory;
  });



  const handleOpenConfirm = async (doc) => {
    setModalDoc(doc);
    setAutoWfName(`WF_${doc.name}`);

    try {
      const res = await axios.get(
        `http://localhost:5000/api/workflows/document/${doc.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setExistingWorkflow(res.data.exists ? res.data.workflow : null);
      setShowConfirmModal(true);

    } catch (err) {
      console.error('Erreur vérification workflow:', err);

      if (err.response?.status === 500) {
        toast.error("Erreur serveur lors de la vérification des workflows");
      } else {
        toast.error("Erreur de connexion");
      }

      setExistingWorkflow(null);
      setShowConfirmModal(true);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setPendingFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form data:', formData);
  };

  const handleConfirmCreate = async () => {
    try {
      const token = localStorage.getItem('token');
      const todayISO = new Date().toISOString().slice(0, 10);

      const res = await axios.post(
        'http://localhost:5000/api/workflows',
        {
          documentId: modalDoc.id,
          name: autoWfName,
          status: 'pending',
          template: modalDoc.category,
          created_by: userId,
          echeance: todayISO
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Workflow créé !');
      setShowConfirmModal(false);
      navigate(`/workflowz/${res.data.id}`, { state: { document: modalDoc } });
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la création du workflow');
    }
  };

  const checkWorkflowExists = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(
        `http://localhost:5000/api/workflows/document/${modalDoc.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.exists) {
        setExistingWorkflow(res.data.workflow);
      } else {
        setExistingWorkflow(null);
      }
      setShowConfirmModal(true);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la vérification du workflow");
    }
  };

  const handleCategoryClick = async (category) => {
    try {
      const res = await fetch(`http://localhost:5000/api/documents?category=${category}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erreur : ${res.status}`);
      const data = await res.json();
      setDocuments(data); // Remplacer la liste actuelle par les documents filtrés
    } catch (err) {
      console.error('Erreur chargement catégorie :', err);
      setErrorMessage('Impossible de charger les documents pour cette catégorie.');
    }
  };


  return (
    <>
      <Navbar />
      <div className="container-fluid">
        <Row className="my-3">
          <Col md={4}><Form.Control type="text" placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></Col>
          <Col md={2}>
            <Form.Select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="Tous les documents">Tous</option>
              <option value="pdf">PDF</option>
              <option value="docx">Word</option>
              <option value="jpg">Images</option>
            </Form.Select>
          </Col>

          <Col md={2}><Form.Control type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Col>
          <Col md={2}><Form.Control type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></Col>
          <Col md={2}><Button variant={useAdvancedFilter ? 'danger' : 'success'} onClick={() => setUseAdvancedFilter(!useAdvancedFilter)}>
            {useAdvancedFilter ? 'Désactiver Avancé' : 'Recherche Avancée'}
          </Button></Col>
        </Row>

        <Container className="mt-5 d-flex justify-content-center">
          <Card className="w-100 shadow-sm" style={{ maxWidth: "1000px" }}>
            <Card.Body>
              <h3 className="text-center mb-4">📂 Liste des documents</h3>

              <Button
                variant={showUploadForm ? "danger" : "primary"}
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="mb-4"
                style={{ marginBottom: "1rem" }}
              >
                {showUploadForm ? 'Annuler' : 'Télécharger un document'}
              </Button>
              {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

              <Card.Body>
                {showUploadForm && (
                  <Card className="mb-4 p-4">
                    <Row className="mb-3">
                      <Col md={3} className="mb-3">
                        <Form.Control
                          type="text"
                          placeholder="Nom du document"
                          value={pendingName}
                          onChange={(e) => setPendingName(e.target.value)}
                          className="rounded-3"
                        />
                      </Col>

                      <Col md={3} className="mb-3 d-flex justify-content-between align-items-center">
                        <input
                          type="file"
                          id="file-upload"
                          style={{ display: 'none' }}
                          accept=".pdf,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => setPendingFile(e.target.files[0])}
                        />
                        <Button
                          variant="outline-primary"
                          onClick={() => document.getElementById('file-upload').click()}
                          className="d-flex align-items-center rounded-3 px-4"
                        >
                          <FaCloudUploadAlt size={20} className="me-2" />
                          {pendingFile ? pendingFile.name : 'Choisir un fichier'}
                        </Button>
                      </Col>

                      <Col md={2} className="mb-3">
                        <Form.Select
                          value={accessType}
                          onChange={(e) => setAccessType(e.target.value)}
                          className="rounded-3"
                        >
                          <option value="private">Privé</option>
                          <option value="public">Tous les utilisateurs</option>
                          <option value="custom">Utilisateurs spécifiques</option>
                        </Form.Select>
                      </Col>

                      {accessType === 'custom' && (
                        <Col md={3} className="mb-3">
                          <Select
                            isMulti
                            options={allUsers}
                            value={allUsers.filter(option => allowedUsers.includes(option.value))}
                            onChange={(selectedOptions) => {
                              const selectedUserIds = selectedOptions.map(opt => opt.value);
                              setSelectedUsers(selectedUserIds); 
                               setAllowedUsers(selectedUserIds);
                            }}
                            placeholder="Sélectionner des utilisateurs..."
                            className="basic-multi-select"
                            classNamePrefix="select"
                          />
                        </Col>
                      )}

                      <Col md={3} className="mb-3">
                        <Form.Control
                          type="text"
                          placeholder="Description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="rounded-3"
                        />
                      </Col>

                      <Col md={2} className="mb-3">
                        <Form.Select
                          value={priority}
                          onChange={(e) => setPriority(e.target.value)}
                          className="rounded-3"
                        >
                          <option value="">Priorité</option>
                          <option value="basse">Basse</option>
                          <option value="moyenne">Moyenne</option>
                          <option value="élevée">Élevée</option>
                        </Form.Select>
                      </Col>

                      <Col md={3} className="mb-3">
                        <Form.Control
                          type="text"
                          placeholder="Mots clés (séparés par des virgules)"
                          value={tags.join(', ')}
                          onChange={(e) => setTags(e.target.value.split(',').map(tag => tag.trim()))}
                          className="rounded-3"
                        />
                      </Col>

                      <Col md={2} className="mb-3 d-flex justify-content-center align-items-center">
                        <OverlayTrigger
                          placement="top"
                          overlay={
                            accessType === 'custom' && allowedUsers.length === 0 ? (
                              <Tooltip id="tooltip-disabled">
                                Veuillez sélectionner au moins un utilisateur.
                              </Tooltip>
                            ) : <span></span>
                          }
                        >
                          <div>
                            <Button
                              onClick={handleUpload}
                              disabled={accessType === 'custom' && allowedUsers.length === 0}
                              className="rounded-3"
                            >
                              Uploader
                            </Button>
                          </div>
                        </OverlayTrigger>
                      </Col>
                    </Row>
                  </Card>
                )}
                {showConflictPrompt && (
                  <div className="conflict-dialog">
                    <p>
                      Un fichier avec le nom <strong>{conflictingDocName}</strong> existe déjà.<br />
                      Voulez-vous sauvegarder une nouvelle version du document ?
                    </p>
                    <button
                      className="button-oui"
                      onClick={() => {
                        setForceUpload(true);
                        handleUpload();
                      }}
                    >
                      Oui
                    </button>
                    <button
                      className="button-non"
                      onClick={() => {
                        setShowConflictPrompt(false);
                        setForceUpload(false);
                      }}
                    >
                      Non
                    </button>
                  </div>
                )}
              </Card.Body>

              <div className="d-flex gap-2 mt-3">
                <Button
                  key="all"
                  variant={selectedCategory === '' ? 'secondary' : 'outline-secondary'}
                  className="rounded-pill fw-semibold px-4 py-2 flex-grow-1 text-center"
                  style={{ transition: 'all 0.2s ease-in-out' }}
                  onClick={() => setSelectedCategory('')}
                  onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
                  onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  Toutes
                </Button>

                {categories.map(cat => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? 'secondary' : 'outline-secondary'}
                    className="rounded-pill fw-semibold px-4 py-2 flex-grow-1 text-center"
                    style={{ transition: 'all 0.2s ease-in-out' }}
                    onClick={() => setSelectedCategory(cat)}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {cat}
                  </Button>
                ))}
              </div>

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
                      <td>
                        {doc.name} {doc.version && `(version ${doc.version})`}
                        <button
                          onClick={() => {
                            setSelectedDoc(doc);
                            navigate(`/docvoir/${doc.id}`);
                            setShowModal(false);
                          }}
                          className="p-0 m-0 bg-transparent border-none outline-none hover:opacity-70"
                          style={{ all: 'unset', cursor: 'pointer' }}
                        >
                          📄
                        </button>
                      </td>
                      <td>{doc.date ? new Date(doc.date).toLocaleString() : 'Inconnue'}</td>
                      <td>{doc.category || 'Non spécifiée'}</td>
                      <td>
                        <Button variant="info" size="sm" className="me-2" onClick={() => navigate(`/documents/${doc.id}`)} title="Détails">
                          <i className="bi bi-list-ul"></i>
                        </Button>

                        <Button variant="danger" size="sm" className="me-2" onClick={() => handleDelete(doc.id)} title="Supprimer">
                          <i className="bi bi-trash"></i>
                        </Button>

                        <Button variant="light" size="sm" onClick={() => openShareModal(doc)}>
                          <img src={shareIcon} width="20" alt="Partager" />
                        </Button>
                        {(doc.owner_id === userId || userRole === 'admin') && (
                        <Button
                          variant="dark"
                          size="sm"
                          className="ms-2"
                          onClick={() => handleOpenConfirm(doc)}
                        >
                          <i className="bi bi-play-fill me-1"></i>
                        </Button>
                      )}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" className="text-center">Aucun document trouvé</td></tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Container>

        <Modal
          show={showShareModal}
          onHide={() => setShowShareModal(false)}
          backdrop="static"
          keyboard={false}
          centered
          style={{ zIndex: 1050 }}
        >
          <Modal.Header closeButton>
            <Modal.Title>Partager le document : {docToShare?.name}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group>
                <Form.Label>Type d'accès</Form.Label>
                <Form.Select
                  value={shareAccessType}
                  onChange={(e) => setShareAccessType(e.target.value)}
                >
                  <option value="public">Public (Tous les utilisateurs)</option>
                  <option value="custom">Sélectionner des utilisateurs</option>
                </Form.Select>
              </Form.Group>

              {shareAccessType === 'custom' && (
                <Form.Group>
                  <Form.Label>Utilisateurs autorisés</Form.Label>
                  <Select
                    isMulti
                    options={users}
                    value={users.filter(option => shareUsers.includes(option.value))}
                    onChange={(selectedOptions) => {
                      const selectedUserIds = selectedOptions.map((opt) => opt.value);
                      setShareUsers(selectedUserIds);
                    }}
                    placeholder="Sélectionner des utilisateurs..."
                    className="basic-multi-select"
                    classNamePrefix="select"
                  />
                </Form.Group>
              )}
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowShareModal(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                const updatedDoc = {
                  ...docToShare,
                  access: shareAccessType,
                  allowedUsers: shareUsers,
                };

                try {
                  await axios.put(`http://localhost:5000/api/documents/${docToShare.id}`, updatedDoc, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  setDocuments(docs => docs.map(doc => doc.id === docToShare.id ? updatedDoc : doc));
                  setShowShareModal(false);
                } catch (err) {
                  console.error('Erreur de mise à jour des permissions', err);
                }
              }}
            >
              Enregistrer
            </Button>
          </Modal.Footer>
        </Modal>

        <Modal
          show={showConfirmModal}
          onHide={() => setShowConfirmModal(false)}
          centered
          style={{ zIndex: 1050 }}
        >
          <Modal.Header closeButton>
            <Modal.Title>Créer un nouveau workflow ?</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {existingWorkflow ? (
              <div className="text-center">
                <Alert variant="warning">
                  Un workflow existe déjà pour ce document !
                </Alert>
                <p><strong>Nom:</strong> {existingWorkflow.name}</p>
                <p><strong>Statut:</strong> {existingWorkflow.status}</p>
                <Button
                  variant="primary"
                  onClick={() => {
                    setShowConfirmModal(false);
                    navigate(`/workflowz/${existingWorkflow.id}`);
                  }}
                >
                  Voir le workflow existant
                </Button>
              </div>
            ) : (
              <>
                <p>Vous êtes sur le point de créer le workflow pour le document :</p>
                <strong>{modalDoc?.name}</strong>
                <hr />
                <Form.Group>
                  <Form.Label>Nom du workflow</Form.Label>
                  <Form.Control
                    type="text"
                    value={autoWfName}
                    onChange={e => setAutoWfName(e.target.value)}
                  />
                </Form.Group>
              </>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmCreate}
              disabled={!!existingWorkflow}
            >
              Créer
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </>
  );
};

export default Doc;