import React, { useState, useEffect } from 'react';
import './DocumentManagementPage.css';
import axios from 'axios';
import { Modal, Button, Form, Table, Pagination } from 'react-bootstrap';
import Select from 'react-select';
import Navbar from './Navbar';

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
  const [useAdvancedFilter, setUseAdvancedFilter] = useState(false);

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

  const filteredDocuments = Array.isArray(documents) ? documents.filter(doc => {
    const matchesType = filterType === 'Tous les documents' || doc.name?.endsWith(filterType);
    const matchesDateStart = !startDate || new Date(doc.date) >= new Date(startDate);
    const matchesDateEnd = !endDate || new Date(doc.date) <= new Date(endDate);

    const matchesBasicSearch = doc.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAdvanced =
      useAdvancedFilter &&
      (
        doc.text_content?.toLowerCase().includes(searchQuery.toLowerCase())
      );

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
    if (useAdvancedFilter) {
      setUseAdvancedFilter(false);
    } else {
      setUseAdvancedFilter(true);
    }
  };

  return (
    <div className="container">
      <div className="content">
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

          <button
            className={useAdvancedFilter ? 'button-sup' : 'button'}
            onClick={handleAdvancedToggle}
          >
            {useAdvancedFilter ? 'Désactiver Recherche Avancée' : 'Activer Recherche Avancée'}
          </button>
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
              <th>category</th>
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
