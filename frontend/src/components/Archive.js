import React, { useEffect, useState } from 'react';
import { 
  Table, Card, Button, Badge, Form, Modal, Spinner, 
  Pagination, Dropdown, Accordion, Tab, Tabs 
} from 'react-bootstrap';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { FiDownload, FiSearch, FiFilter, FiPrinter, FiFileText } from 'react-icons/fi';
import Navbar from './Navbar';

const ArchivePage = () => {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'completed_at', direction: 'desc' });
  const [filters, setFilters] = useState({
    dateRange: null,
    reportType: 'all'
  });

  // Fonction de récupération des archives avec filtres
  const fetchArchives = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
        sort: `${sortConfig.key},${sortConfig.direction}`,
        ...filters
      };

      const res = await axios.get('http://localhost:5000/api/workflows/archives', {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });

      setArchives(res.data);
    } catch (err) {
      handleFetchError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchError = (err) => {
    console.error('Erreur:', err);
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else {
      toast.error(err.response?.data?.message || 'Erreur lors du chargement des archives');
    }
  };

  useEffect(() => {
    fetchArchives();
  }, [currentPage, searchTerm, sortConfig, filters]);

  // Tri des données
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Téléchargement des rapports
  const downloadReport = (archive, format = 'txt') => {
    const content = format === 'pdf' 
      ? generatePdfReport(archive) 
      : archive.validation_report;
    
    const element = document.createElement('a');
    const file = new Blob([content], {type: `text/${format}`});
    element.href = URL.createObjectURL(file);
    element.download = `rapport_${archive.document_id}_${format(parseISO(archive.completed_at), 'yyyy-MM-dd')}.${format}`;
    document.body.appendChild(element);
    element.click();
  };

  // Génération PDF (simplifiée)
  const generatePdfReport = (archive) => {
    return `
      ===== RAPPORT PDF =====
      Workflow: ${archive.name}
      Document: DOC-${archive.document_id}
      Date: ${format(parseISO(archive.completed_at), 'PPpp', { locale: fr })}
      
      ${archive.validation_report}
    `;
  };

  // Export complet des données
  const exportAllToCSV = () => {
    const headers = ['ID', 'Document', 'Workflow', 'Date achèvement', 'Statut'];
    const csvContent = [
      headers.join(','),
      ...archives.map(a => [
        a.id,
        `DOC-${a.document_id}`,
        `"${a.name}"`,
        format(parseISO(a.completed_at), 'yyyy-MM-dd'),
        a.status
      ].join(','))
    ].join('\n');

    const element = document.createElement('a');
    const file = new Blob([csvContent], {type: 'text/csv'});
    element.href = URL.createObjectURL(file);
    element.download = `archives_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(element);
    element.click();
  };

  // Fonction de restauration
  const restoreArchive = async (archiveId) => {
    if (window.confirm('Voulez-vous vraiment restaurer ce workflow?')) {
      try {
        await axios.post(`/api/workflows/archives/${archiveId}/restore`, {}, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        toast.success('Workflow restauré avec succès');
        fetchArchives();
      } catch (err) {
        handleFetchError(err);
      }
    }
  };

  return (
    <><Navbar />
    <div className="container-fluid py-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap">
          <div className="d-flex align-items-center mb-2 mb-md-0">
            <h4 className="mb-0 me-3">Archives des Workflows</h4>
            <Badge bg="secondary" pill>{archives.length} résultats</Badge>
          </div>
          
          <div className="d-flex flex-wrap gap-2">
            <div className="position-relative">
              <FiSearch className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
              <Form.Control
                type="search"
                placeholder="Rechercher..."
                style={{ width: '250px', paddingLeft: '2.5rem' }}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Dropdown>
              <Dropdown.Toggle variant="outline-secondary">
                <FiFilter className="me-1" /> Filtres
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.ItemText>Filtrer par :</Dropdown.ItemText>
                <Form.Group className="px-3 py-2">
                  <Form.Label>Date</Form.Label>
                  <Form.Control 
                    type="date" 
                    onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
                  />
                </Form.Group>
                <Form.Group className="px-3 py-2">
                  <Form.Label>Type de rapport</Form.Label>
                  <Form.Select 
                    onChange={(e) => setFilters({...filters, reportType: e.target.value})}
                  >
                    <option value="all">Tous</option>
                    <option value="with_report">Avec rapport</option>
                    <option value="without_report">Sans rapport</option>
                  </Form.Select>
                </Form.Group>
              </Dropdown.Menu>
            </Dropdown>
            
            <Dropdown>
              <Dropdown.Toggle variant="outline-primary">
                <FiDownload className="me-1" /> Exporter
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={exportAllToCSV}>CSV complet</Dropdown.Item>
                <Dropdown.Item onClick={() => exportAllToCSV()}>PDF sélection</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </Card.Header>
        
        <Card.Body>
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Chargement des archives...</p>
            </div>
          ) : archives.length === 0 ? (
            <div className="text-center py-5">
              <FiFileText size={48} className="text-muted mb-3" />
              <h5>Aucune archive trouvée</h5>
              <p className="text-muted">Aucun workflow n'a été archivé pour le moment</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table striped hover className="mb-0">
                  <thead>
                    <tr>
                      <th onClick={() => requestSort('document_id')} className="cursor-pointer">
                        Document {sortConfig.key === 'document_id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => requestSort('name')} className="cursor-pointer">
                        Workflow {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => requestSort('completed_at')} className="cursor-pointer">
                        Date {sortConfig.key === 'completed_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>Rapport</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archives.map(archive => (
                      <tr key={archive.id}>
                        <td>DOC-{archive.document_id}</td>
                        <td>{archive.name}</td>
                        <td>{format(parseISO(archive.completed_at), 'PP', { locale: fr })}</td>
                        <td>
                          <Badge bg={archive.validation_report ? 'success' : 'secondary'}>
                            {archive.validation_report ? 'Disponible' : 'Aucun'}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Button variant="outline-primary" size="sm" onClick={() => {
                              setSelectedArchive(archive);
                              setShowModal(true);
                            }}>
                              Détails
                            </Button>
                            <Dropdown>
                              <Dropdown.Toggle variant="outline-secondary" size="sm" id="dropdown-actions" >
                                Plus
                              </Dropdown.Toggle>
                              <Dropdown.Menu style={{ zIndex: 1050, width: '100%' }}>
                                <Dropdown.Item onClick={() => downloadReport(archive, 'txt')}>
                                  <FiDownload className="me-2" /> Télécharger (TXT)
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => downloadReport(archive, 'pdf')}>
                                  <FiDownload className="me-2" /> Télécharger (PDF)
                                </Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item onClick={() => restoreArchive(archive.id)}>
                                  Restaurer
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              
              <div className="d-flex justify-content-between align-items-center mt-3">
                <div className="text-muted">
                  Affichage de {Math.min(archives.length, itemsPerPage)} sur {archives.length} archives
                </div>
                <Pagination>
                  <Pagination.Prev 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  />
                  {[...Array(Math.ceil(archives.length / itemsPerPage)).keys()].map(num => (
                    <Pagination.Item
                      key={num + 1}
                      active={num + 1 === currentPage}
                      onClick={() => setCurrentPage(num + 1)}
                    >
                      {num + 1}
                    </Pagination.Item>
                  ))}
                  <Pagination.Next 
                    disabled={currentPage === Math.ceil(archives.length / itemsPerPage)} 
                    onClick={() => setCurrentPage(p => p + 1)} 
                  />
                </Pagination>
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      {/* Modal de détails */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered style={{ zIndex: 1050, width: '100%' }}
      >
        <Modal.Header closeButton>
          <Modal.Title>Détails de l'archive</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedArchive && (
            <Tabs defaultActiveKey="report" className="mb-3">
              <Tab eventKey="report" title="Rapport">
                <div className="mt-3">
                  <h5>{selectedArchive.name}</h5>
                  <div className="row mt-3">
                    <div className="col-md-6">
                      <p><strong>Document:</strong> DOC-{selectedArchive.document_id}</p>
                      <p><strong>Créé par:</strong> {selectedArchive.creator}</p>
                    </div>
                    <div className="col-md-6">
                      <p><strong>Date de création:</strong> {format(parseISO(selectedArchive.workflow_created_at), 'PPpp', { locale: fr })}</p>
                      <p><strong>Date d'achèvement:</strong> {format(parseISO(selectedArchive.completed_at), 'PPpp', { locale: fr })}</p>
                    </div>
                  </div>
                  
                  <Card className="mt-3">
                    <Card.Header className="d-flex justify-content-between align-items-center">
                      <span>Rapport de validation</span>
                      <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={() => downloadReport(selectedArchive)}
                      >
                        <FiDownload className="me-1" /> Télécharger
                      </Button>
                    </Card.Header>
                    <Card.Body>
                      <pre style={{ whiteSpace: 'pre-wrap' }}>
                        {selectedArchive.validation_report || 'Aucun rapport disponible'}
                      </pre>
                    </Card.Body>
                  </Card>
                </div>
              </Tab>
              <Tab eventKey="stats" title="Statistiques">
                <div className="mt-3">
                  <h5>Statistiques du workflow</h5>
                  <div className="row mt-3">
                    <div className="col-md-6">
                      <Card className="mb-3">
                        <Card.Body>
                          <h6 className="text-muted">Tâches</h6>
                          <h3>
                            {selectedArchive.stats.completed_tasks} / {selectedArchive.stats.total_tasks}
                            <small className="text-muted ms-2">
                              ({selectedArchive.stats.completion_rate}%)
                            </small>
                          </h3>
                        </Card.Body>
                      </Card>
                    </div>
                    <div className="col-md-6">
                      <Card className="mb-3">
                        <Card.Body>
                          <h6 className="text-muted">Durée</h6>
                          <h3>
                            {selectedArchive.stats.workflow_duration} jours
                          </h3>
                        </Card.Body>
                      </Card>
                    </div>
                  </div>
                </div>
              </Tab>
            </Tabs>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Fermer
          </Button>
          <Button variant="primary" onClick={() => {
            downloadReport(selectedArchive);
            setShowModal(false);
          }}>
            <FiPrinter className="me-1" /> Imprimer
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
    </>
  );
};

export default ArchivePage;