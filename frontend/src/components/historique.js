// src/pages/ActivityLog.js
import React, { useState, useEffect } from 'react';
import { Container, Table, Card, Form, Spinner, Alert } from 'react-bootstrap';
import axios from 'axios';
import Navbar from './Navbar';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { jwtDecode } from 'jwt-decode';

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
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchActivities();
  }, [userId, filters]);

  const renderActionIcon = (actionType) => {
    const icons = {
      login: '🔐',
      logout: '🚪',
      upload: '⬆️',
      delete: '❌',
      update: '✏️',
      create: '➕',
      download: '⬇️'
    };
    return icons[actionType] || '⚙️';
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
        <a href={links[activity.entity_type]} className="text-primary">
          Voir {activity.entity_type}
        </a>
      );
    }
    return null;
  };

  return (
    <>
      <Navbar />
      <Container className="my-4">
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center">
            <h4>📜 Journal d'Activité</h4>
            <div>
              <Form.Control
                type="date"
                onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                className="d-inline-block me-2"
                style={{ width: 'auto' }}
              />
              <Form.Control
                type="date"
                onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                className="d-inline-block me-2"
                style={{ width: 'auto' }}
              />
              <Form.Select
                onChange={(e) => setFilters({...filters, actionType: e.target.value})}
                style={{ width: 'auto' }}
                className="d-inline-block"
              >
                <option value="">Toutes les actions</option>
                <option value="login">Connexions</option>
                <option value="upload">Uploads</option>
                <option value="delete">Suppressions</option>
              </Form.Select>
            </div>
          </Card.Header>
          <Card.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            
            {loading ? (
              <div className="text-center my-5">
                <Spinner animation="border" />
              </div>
            ) : activities.length === 0 ? (
              <Alert variant="info">Aucune activité trouvée</Alert>
            ) : (
              <Table striped hover responsive>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Type</th>
                    <th>Détails</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr key={activity.id}>
                      <td>
                        <span style={{ fontSize: '1.2em' }}>
                          {renderActionIcon(activity.action_type)}
                        </span>
                        {activity.action_type}
                      </td>
                      <td>{activity.entity_type || '-'}</td>
                      <td>
                        <div>
                          {activity.details && (
                            <small className="text-muted">
                              {JSON.stringify(activity.details)}
                            </small>
                          )}
                          {renderEntityLink(activity)}
                        </div>
                      </td>
                      <td>
                        {format(new Date(activity.created_at), 'PPpp', { locale: fr })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
      </Container>
    </>
  );
};

export default ActivityLog;