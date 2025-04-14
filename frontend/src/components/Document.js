import React, { useState, useEffect } from 'react';
import './DocumentManagementPage.css';

const Document = () => {
  const [documents, setDocuments] = useState([]);
  const [pendingName, setPendingName] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('Tous les documents');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advancedDetails, setAdvancedDetails] = useState('');

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
      .then(data => setDocuments(data))
      .catch(err => {
        console.error('Erreur lors du chargement des documents', err);
        setErrorMessage("Erreur d'autorisation ou de connexion.");
      });
  }, [token]);

  const handleUpload = async () => {
    if (!pendingFile || !pendingName) {
      setErrorMessage('Veuillez choisir un nom et un fichier.');
      return;
    }

    const formData = new FormData();
    formData.append('name', pendingName);
    formData.append('file', pendingFile);

    try {
      const res = await fetch('http://localhost:5000/api/documents/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
          // Pas de Content-Type ici, fetch le gère avec FormData
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Erreur : ${res.status}`);
      }
      if (pendingFile.size > 10 * 1024 * 1024) {
        setErrorMessage("Le fichier dépasse la limite de 10 Mo.");
        return;
      }
      
      const newDoc = await res.json();
      setDocuments([newDoc, ...documents]);
      setPendingFile(null);
      setPendingName('');
      setErrorMessage(null);
    } catch (err) {
      console.error('Erreur d\'upload :', err);
      setErrorMessage("Erreur lors de l'envoi du document.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    try {
      await fetch(`http://localhost:5000/api/documents/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setDocuments(documents.filter(doc => doc.id !== id));
    } catch (err) {
      console.error('Erreur suppression :', err);
    }
  };

  const filteredDocuments = Array.isArray(documents) ? documents.filter(doc =>
    (filterType === 'Tous les documents' || doc.name?.endsWith(filterType)) &&
    (doc.name?.toLowerCase().includes(searchQuery.toLowerCase()) || '') &&
    (!startDate || new Date(doc.date) >= new Date(startDate)) &&
    (!endDate || new Date(doc.date) <= new Date(endDate))
  ) : [];

  const consultDocument = (url) => {
    window.open(`http://localhost:5000${url}`, '_blank');
  };

  return (
    <div className="container">
      <nav className="the-navbar">
        <div className="logo-container">
          <img alt="Logo" className="logo" />
        </div>
        <div className="nav-buttons">
          <button className="nav-button">Statistiques</button>
          <button className="nav-button">Workflows</button>
          <button className="nav-button">À propos</button>
        </div>
      </nav>

      <div className="content">
        <nav className="navbar">
          <div className="nav-right">
            <button className="nav">Accueil</button>
            <button className="nav">Déconnexion</button>
          </div>
        </nav>

        <h1>Gestion des Documents</h1>

        <div className="controls">
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="Tous les documents">Tous les documents</option>
            <option value=".pdf">PDF</option>
            <option value=".docx">Word</option>
            <option value=".jpg">Images</option>
          </select>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <button className="button" onClick={() => setShowAdvancedSearch(true)}>Recherche Avancée</button>
        </div>

        {errorMessage && <p className="error">{errorMessage}</p>}

        <div className="document-upload">
          <input
            type="text"
            placeholder="Nom du document"
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
          />
          <input
            type="file"
            onChange={(e) => setPendingFile(e.target.files[0])}
            accept=".pdf,.docx,.jpg,.jpeg,.png"
          />
          <button className="button" onClick={handleUpload}>Ajouter</button>
        </div>

        <table className="document-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocuments.map(doc => (
              <tr key={doc.id}>
                <td>{doc.name}</td>
                <td>{new Date(doc.date).toLocaleString()}</td>
                <td className="actions">
                  <button className="button" onClick={() => consultDocument(doc.file_path)}>Consulter</button>
                  <button className="button-sup" onClick={() => handleDelete(doc.id)}>Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdvancedSearch && (
        <div className="modal">
          <div className="modal-content">
            <h2>Recherche Avancée</h2>
            <textarea
              placeholder="Entrez des détails..."
              value={advancedDetails}
              onChange={(e) => setAdvancedDetails(e.target.value)}
            />
            <button className="button" onClick={() => setShowAdvancedSearch(false)}>Fermer</button>
            <button className="button" onClick={() => {
              setShowAdvancedSearch(false);
              alert('Recherche avancée soumise : ' + advancedDetails);
            }}>
              Soumettre
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Document;
