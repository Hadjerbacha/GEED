// src/pages/ActivityLog.js
import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Table, 
  Card, 
  Form, 
  Spinner, 
  Alert, 
  Badge,
  Button,
  Row,
  Col
} from 'react-bootstrap';
import axios from 'axios';
import Navbar from './Navbar';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { jwtDecode } from 'jwt-decode';
import { FiLogIn, FiLogOut, FiUpload, FiTrash2, FiEdit, FiPlus, FiDownload } from 'react-icons/fi';
import '../style/activity.css'; // Assurez-vous d'importer le fichier CSS pour le style

const ActivityLog = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [filters, setFilters] = useState({
    actionType: '',
    entityType: '',
    dateFrom: '',
    dateTo: ''
  });
  const [expandedRows, setExpandedRows] = useState([]);

  // Get user ID from token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      setUserId(decoded.id);
    }
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.actionType) params.append('actionType', filters.actionType);
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const { data } = await axios.get(`/api/activities/me?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setActivities(data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du chargement des activités');
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchActivities();
  }, [userId, filters]);

  const handleResetFilters = () => {
    setFilters({
      actionType: '',
      entityType: '',
      dateFrom: '',
      dateTo: ''
    });
  };

  const toggleRowExpand = (id) => {
    if (expandedRows.includes(id)) {
      setExpandedRows(expandedRows.filter(rowId => rowId !== id));
    } else {
      setExpandedRows([...expandedRows, id]);
    }
  };

  const renderActionIcon = (actionType) => {
    const iconSize = 18;
    const icons = {
      login: <FiLogIn size={iconSize} className="text-primary" />,
      logout: <FiLogOut size={iconSize} className="text-secondary" />,
      upload: <FiUpload size={iconSize} className="text-success" />,
      delete: <FiTrash2 size={iconSize} className="text-danger" />,
      update: <FiEdit size={iconSize} className="text-warning" />,
      create: <FiPlus size={iconSize} className="text-info" />,
      download: <FiDownload size={iconSize} className="text-primary" />
    };
    return icons[actionType] || <FiEdit size={iconSize} />;
  };

  const renderActionBadge = (actionType) => {
    const actionLabels = {
      login: 'Connexion',
      logout: 'Déconnexion',
      upload: 'Upload',
      delete: 'Suppression',
      update: 'Modification',
      create: 'Création',
      download: 'Téléchargement'
    };

    const badgeVariants = {
      login: 'primary',
      logout: 'secondary',
      upload: 'success',
      delete: 'danger',
      update: 'warning',
      create: 'info',
      download: 'primary'
    };

    return (
      <Badge bg={badgeVariants[actionType] || 'dark'} className="text-capitalize">
        {actionLabels[actionType] || actionType}
      </Badge>
    );
  };

  const renderEntityLink = (activity) => {
    if (!activity.entity_id) return null;
    
    const links = {
      document: `/documents/${activity.entity_id}`,
      user: `/users/${activity.entity_id}`,
      task: `/tasks/${activity.entity_id}`
    };
    
    if (links[activity.entity_type]) {
      return (
        <Button 
          variant="link" 
          size="sm" 
          href={links[activity.entity_type]}
          className="px-0"
        >
          Voir {activity.entity_type}
        </Button>
      );
    }
    return null;
  };

  const formatDetails = (details) => {
    if (!details) return null;
    
    try {
      const parsedDetails = typeof details === 'string' ? JSON.parse(details) : details;
      return Object.entries(parsedDetails).map(([key, value]) => (
        <div key={key} className="detail-item">
          <strong>{key}:</strong> {String(value)}
        </div>
      ));
    } catch {
      return <div className="text-muted">{String(details)}</div>;
    }
  };

  return (
    <>
      <Navbar />
      <Container fluid className="activity-log-container my-4">
        <Card className="shadow-sm">
          <Card.Header className="py-3">
            <Row className="align-items-center">
              <Col md={6}>
                <h4 className="mb-0">
                  <i className="bi bi-clock-history me-2"></i>
                  Journal d'Activité
                </h4>
              </Col>
              <Col md={6} className="text-md-end">
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  onClick={handleResetFilters}
                  className="me-2"
                >
                  Réinitialiser
                </Button>
              </Col>
            </Row>
          </Card.Header>
          
          <Card.Body className="p-0">
            <div className="filter-section p-3 border-bottom">
              <Row>
                <Col md={3}>
                  <Form.Group controlId="dateFrom">
                    <Form.Label>Du</Form.Label>
                    <Form.Control
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group controlId="dateTo">
                    <Form.Label>Au</Form.Label>
                    <Form.Control
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group controlId="actionType">
                    <Form.Label>Type d'action</Form.Label>
                    <Form.Select
                      value={filters.actionType}
                      onChange={(e) => setFilters({...filters, actionType: e.target.value})}
                    >
                      <option value="">Toutes les actions</option>
                      <option value="login">Connexions</option>
                      <option value="logout">Déconnexions</option>
                      <option value="upload">Uploads</option>
                      <option value="delete">Suppressions</option>
                      <option value="update">Modifications</option>
                      <option value="create">Créations</option>
                      <option value="download">Téléchargements</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group controlId="entityType">
                    <Form.Label>Type d'entité</Form.Label>
                    <Form.Select
                      value={filters.entityType}
                      onChange={(e) => setFilters({...filters, entityType: e.target.value})}
                    >
                      <option value="">Tous les types</option>
                      <option value="document">Documents</option>
                      <option value="user">Utilisateurs</option>
                      <option value="task">Tâches</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
            </div>

            {error && (
              <Alert variant="danger" className="m-3">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {error}
              </Alert>
            )}
            
            {loading ? (
              <div className="text-center my-5 py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2">Chargement des activités...</p>
              </div>
            ) : activities.length === 0 ? (
              <Alert variant="info" className="m-3">
                <i className="bi bi-info-circle-fill me-2"></i>
                Aucune activité trouvée pour les critères sélectionnés
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '15%' }}>Action</th>
                      <th style={{ width: '15%' }}>Type</th>
                      <th style={{ width: '40%' }}>Détails</th>
                      <th style={{ width: '20%' }}>Date</th>
                      <th style={{ width: '10%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((activity) => (
                      <React.Fragment key={activity.id}>
                        <tr 
                          className={expandedRows.includes(activity.id) ? 'table-active' : ''}
                          onClick={() => toggleRowExpand(activity.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <div className="d-flex align-items-center">
                              <span className="me-2">
                                {renderActionIcon(activity.action_type)}
                              </span>
                              {renderActionBadge(activity.action_type)}
                            </div>
                          </td>
                          <td>
                            {activity.entity_type ? (
                              <Badge bg="light" text="dark" className="text-capitalize">
                                {activity.entity_type}
                              </Badge>
                            ) : '-'}
                          </td>
                          <td>
                            <div className="text-truncate" style={{ maxWidth: '300px' }}>
                              {activity.details && (
                                <small className="text-muted">
                                  {typeof activity.details === 'string' 
                                    ? activity.details 
                                    : JSON.stringify(activity.details)}
                                </small>
                              )}
                            </div>
                            {renderEntityLink(activity)}
                          </td>
                          <td>
                            {format(new Date(activity.created_at), 'PPpp', { locale: fr })}
                          </td>
                          <td className="text-end">
                            <Button 
                              variant="link" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpand(activity.id);
                              }}
                            >
                              <i className={`bi bi-chevron-${expandedRows.includes(activity.id) ? 'up' : 'down'}`}></i>
                            </Button>
                          </td>
                        </tr>
                        {expandedRows.includes(activity.id) && (
                          <tr>
                            <td colSpan="5" className="bg-light">
                              <div className="p-3">
                                <h6>Détails complets :</h6>
                                <div className="details-container">
                                  {formatDetails(activity.details)}
                                </div>
                                <div className="mt-2">
                                  <small className="text-muted">
                                    ID: {activity.id} | IP: {activity.ip_address || 'N/A'} | 
                                    Agent: {activity.user_agent || 'N/A'}
                                  </small>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
          
          {activities.length > 0 && !loading && (
            <Card.Footer className="py-2 text-muted">
              <small>
                Affichage de {activities.length} activité{activities.length > 1 ? 's' : ''}
              </small>
            </Card.Footer>
          )}
        </Card>
      </Container>
    </>
  );
};

export default ActivityLog;