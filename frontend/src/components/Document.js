import React, { useState, useEffect } from 'react';
import './DocumentManagementPage.css';
import axios from 'axios';

const Document = () => {
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

  // Conflit de version
  const [showConflictPrompt, setShowConflictPrompt] = useState(false);
  const [conflictingDocName, setConflictingDocName] = useState('');
  const [forceUpload, setForceUpload] = useState(false);

  const token = localStorage.getItem('token');

  // Fetch documents
  const fetchDocuments = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/documents/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) throw new Error('Non autorisé');
      const data = await res.json();
      if (Array.isArray(data)) {
        setDocuments(data);
        const names = data
          .map(doc => doc.collectionName)
          .filter(name => name && typeof name === 'string');
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

  // Consultation
  const consultDocument = url => {
    window.open(`http://localhost:5000${url}`, '_blank');
  };

  // Suppression
  const handleDelete = async id => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;
    try {
      await fetch(`http://localhost:5000/api/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(documents.filter(d => d.id !== id));
      setSavedDocuments(savedDocuments.filter(d => d.id !== id));
    } catch (err) {
      console.error('Erreur suppression :', err);
    }
  };

  // Toggle save
  const toggleSaveDocument = doc => {
    const exists = savedDocuments.some(d => d.id === doc.id);
    if (exists) {
      setSavedDocuments(savedDocuments.filter(d => d.id !== doc.id));
    } else {
      setSavedDocuments([...savedDocuments, doc]);
      setIsSavingCollection(true);
    }
  };

  // Upload
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
      // Reset
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
      setErrorMessage('Erreur lors de l\'envoi du document.');
    }
  };
  //version document
  

  // Sauvegarde collection
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

  // Filtre avancé
  const handleAdvancedToggle = () => setUseAdvancedFilter(prev => !prev);

  // Highlight
  const highlightMatch = (text, query) => {
    if (!text || !query) return text;
    const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${esc})`, 'gi');
    return text.split(regex).map((part, i) =>
      regex.test(part) ? <span key={i} className="highlight">{part}</span> : part
    );
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const docName = doc.name || '';
    const docDate = doc.date ? new Date(doc.date) : null;
    const matchesType =
      filterType === 'Tous les documents' || docName.endsWith(filterType);
    const matchesDate =
      (!startDate || docDate >= new Date(startDate)) &&
      (!endDate || docDate <= new Date(endDate));
    const matchesSearch = docName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAdvanced =
      useAdvancedFilter &&
      (doc.text_content || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesDate && (matchesSearch || matchesAdvanced);
  });

  return (
    <div className="container">
      <div className="content">
        <h1>Gestion des Documents</h1>
        <div className="controls">
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <select value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="Tous les documents">Tous les documents</option>
            <option value=".pdf">PDF</option>
            <option value=".docx">Word</option>
            <option value=".jpg">Images</option>
          </select>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <button className={useAdvancedFilter ? 'button-sup' : 'button-re'} onClick={handleAdvancedToggle}>
            {useAdvancedFilter ? 'Désactiver Recherche Avancée' : 'Activer Recherche Avancée'}
          </button>
        </div>

        {errorMessage && <p className="error">{errorMessage}</p>}

        <div className="document-upload">
          <input
            type="text"
            placeholder="Nom du document"
            value={pendingName}
            onChange={e => setPendingName(e.target.value)}
          />
          <label className="file-label">
            Choisir un fichier
            <input
              type="file"
              onChange={e => setPendingFile(e.target.files[0])}
              accept=".pdf,.docx,.jpg,.jpeg,.png"
            />
          </label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Choisir une catégorie</option>
            <option value="rapport">Rapport</option>
            <option value="article">Article</option>
            <option value="mémoire">Mémoire</option>
            <option value="autre">Autre</option>
          </select>
          <button onClick={handleUpload}>Uploader</button>

          {/* Bloc confirmation conflit de version */}
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
        </div>

        {isSavingCollection && savedDocuments.length > 0 && (
          <div className="saved-collection">
            <h3>📁 Ma Collection</h3>
            <select value={selectedExistingCollection} onChange={e => setSelectedExistingCollection(e.target.value)}>
              <option value="">Choisir une collection existante</option>
              {collections.map(col => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="...ou entrer un nouveau nom"
              value={collectionName}
              onChange={e => setCollectionName(e.target.value)}
            />
            <button onClick={saveCollection}>Sauvegarder dans la collection</button>
            <ul>
              {savedDocuments.map(doc => (
                <li key={doc.id}>
                  {doc.name} - {doc.category}
                  <button onClick={() => toggleSaveDocument(doc)}>❌</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <table className="document-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Date</th>
              <th>Catégorie</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocuments.length > 0 ? (
              filteredDocuments.map(doc => (
                <tr key={doc.id}>
                 <td>
                     {highlightMatch(doc.name, searchQuery)}{' '}
                     {doc.version ? `(version ${doc.version})` : ''}
                        </td>

                  <td>{doc.date ? new Date(doc.date).toLocaleString() : 'Date inconnue'}</td>
                  <td>{doc.category || 'Non spécifié'}</td>
                  <td className="actions">
                    <button className="button" onClick={() => consultDocument(doc.file_path)}>
                      Consulter
                    </button>
                    <button className="button-sup" onClick={() => handleDelete(doc.id)}>
                      Supprimer
                    </button>
                    <button className="button-save" onClick={() => toggleSaveDocument(doc)}>
                      {savedDocuments.some(saved => saved.id === doc.id)
                        ? 'Retirer de la collection'
                        : 'Save'}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center' }}>
                  Aucun document trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Document;