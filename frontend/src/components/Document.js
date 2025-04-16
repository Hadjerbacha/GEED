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

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch('http://localhost:5000/api/documents/', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => {
        if (res.status === 401) throw new Error('Non autorisé');
        return res.json();
      })
      .then(data => {
        setDocuments(data);
        const uniqueCollections = [...new Set(data.map(doc => doc.collectionName).filter(Boolean))];
        setCollections(uniqueCollections);
      })
      .catch(err => {
        console.error('Erreur lors du chargement des documents', err);
        setErrorMessage("Erreur d'autorisation ou de connexion.");
      });
  }, [token]);

  const toggleSaveDocument = (doc) => {
    const isAlreadySaved = savedDocuments.find(saved => saved.id === doc.id);
    if (isAlreadySaved) {
      setSavedDocuments(savedDocuments.filter(saved => saved.id !== doc.id));
    } else {
      setSavedDocuments([...savedDocuments, doc]);
      setIsSavingCollection(true);
    }
  };

  const handleUpload = async () => {
    if (!pendingFile || !pendingName || !category) {
      setErrorMessage('Veuillez remplir tous les champs requis.');
      return;
    }

    if (pendingFile.size > 10 * 1024 * 1024) {
      setErrorMessage("Le fichier dépasse la limite de 10 Mo.");
      return;
    }

    const formData = new FormData();
    formData.append('name', pendingName);
    formData.append('file', pendingFile);
    formData.append('category', category);
    formData.append('collectionName', collectionName);

    try {
      const res = await fetch('http://localhost:5000/api/documents/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error(`Erreur : ${res.status}`);

      const newDoc = await res.json();
      setDocuments([newDoc, ...documents]);
      setPendingFile(null);
      setPendingName('');
      setCategory('');
      setCollectionName('');
      setErrorMessage(null);
    } catch (err) {
      console.error("Erreur d'upload :", err);
      setErrorMessage("Erreur lors de l'envoi du document.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    try {
      await fetch(`http://localhost:5000/api/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      setDocuments(documents.filter(doc => doc.id !== id));
      setSavedDocuments(savedDocuments.filter(doc => doc.id !== id));
    } catch (err) {
      console.error('Erreur suppression :', err);
    }
  };

  const filteredDocuments = Array.isArray(documents) ? documents.filter(doc => {
    const matchesType = filterType === 'Tous les documents' || doc.name?.endsWith(filterType);
    const matchesDateStart = !startDate || new Date(doc.date) >= new Date(startDate);
    const matchesDateEnd = !endDate || new Date(doc.date) <= new Date(endDate);
    const matchesBasicSearch = doc.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAdvanced = useAdvancedFilter && doc.text_content?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesDateStart && matchesDateEnd && (matchesBasicSearch || matchesAdvanced);
  }) : [];

  const highlightMatch = (text, query) => {
    if (!query) return [text];
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <span key={i} className="highlight">{part}</span> : part
    );
  };

  const consultDocument = (url) => {
    window.open(`http://localhost:5000${url}`, '_blank');
  };

  const handleAdvancedToggle = () => {
    setUseAdvancedFilter(prev => !prev);
  };

  const saveCollection = async () => {
    const nameToUse = selectedExistingCollection || collectionName;

    if (!nameToUse) {
      setErrorMessage("Veuillez choisir ou entrer un nom de collection.");
      return;
    }

    try {
      const updatedDocs = await Promise.all(savedDocuments.map(async (doc) => {
        const res = await axios.put(`http://localhost:5000/api/documents/${doc.id}`, {
          collectionName: nameToUse
        }, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        return res.data;
      }));

      setDocuments(prev => prev.map(doc => {
        const updated = updatedDocs.find(d => d.id === doc.id);
        return updated ? updated : doc;
      }));

      setSavedDocuments([]);
      setCollectionName('');
      setSelectedExistingCollection('');
      setIsSavingCollection(false);

      if (!collections.includes(nameToUse)) {
        setCollections([...collections, nameToUse]);
      }
    } catch (err) {
      console.error("Erreur lors de la sauvegarde de la collection :", err);
      setErrorMessage("Erreur lors de la sauvegarde des documents dans la collection.");
    }
  };

  return (
    <div className="container">
      <div className="content">
        <h1>Gestion des Documents</h1>

        <div className="controls">
          <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
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
  <input type="text" placeholder="Nom du document" value={pendingName} onChange={(e) => setPendingName(e.target.value)} />
  
  <label className="file-label">
    Choisir un fichier
    <input type="file" onChange={(e) => setPendingFile(e.target.files[0])} accept=".pdf,.docx,.jpg,.jpeg,.png" />
  </label>

  <select value={category} onChange={(e) => setCategory(e.target.value)}>
    <option value="">Choisir une catégorie</option>
    <option value="rapport">Rapport</option>
    <option value="article">Article</option>
    <option value="mémoire">Mémoire</option>
    <option value="autre">Autre</option>
  </select>
  <button onClick={handleUpload}>Uploader</button>
</div>


        {isSavingCollection && savedDocuments.length > 0 && (
          <div className="saved-collection">
            <h3>📁 Ma Collection</h3>
            <select value={selectedExistingCollection} onChange={(e) => setSelectedExistingCollection(e.target.value)}>
              <option value="">Choisir une collection existante</option>
              {collections.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
            <input
              type="text"
              placeholder="...ou entrer un nouveau nom"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
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
            {filteredDocuments.map(doc => (
              <tr key={doc.id}>
                <td>{highlightMatch(doc.name, searchQuery)}</td>
                <td>{new Date(doc.date).toLocaleString()}</td>
                <td>{doc.category}</td>
                <td className="actions">
                  <button className="button" onClick={() => consultDocument(doc.file_path)}>Consulter</button>
                  <button className="button-sup" onClick={() => handleDelete(doc.id)}>Supprimer</button>
                  <button className="button-save" onClick={() => toggleSaveDocument(doc)}>
                    {savedDocuments.find(saved => saved.id === doc.id) ? 'Retirer de la collection' : 'Save'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Document;
