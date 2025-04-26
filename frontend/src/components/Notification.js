import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, Button } from 'react-bootstrap';
import { jwtDecode } from 'jwt-decode';
import Navbar from './Navbar';

const NotificationsPage = () => {
  const [reminders, setReminders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [userId, setUserId] = useState("");

  // Décoder le token pour récupérer userId
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      setUserId(decoded.id);
    }
  }, []);

  // Charger les notifications et rappels
  useEffect(() => {
    if (userId) {
      fetchNotifications();
      fetchReminders();
    }
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/notifications/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(res.data);
    } catch (error) {
      console.error('Erreur lors de la récupération des notifications:', error);
    }
  };

  const fetchReminders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const tasks = res.data;
      const today = new Date();

      const upcomingTasks = tasks
        .filter(task => {
          if (!task.due_date || !task.assigned_to) return false;

          const isAssignedToUser = task.assigned_to.includes(userId);
          if (!isAssignedToUser) return false;

          const dueDate = new Date(task.due_date);
          const diffDays = (dueDate - today) / (1000 * 60 * 60 * 24);

          return diffDays >= 0 && diffDays <= 10; // dans 10 jours max
        })
        .map(task => ({
          id: task.id,
          title: task.title,
          message: `La tâche "${task.title}" est prévue pour le ${new Date(task.due_date).toLocaleDateString()}.`,
          deadline: task.due_date,
        }));

      setReminders(upcomingTasks);
    } catch (error) {
      console.error('Erreur lors de la récupération des rappels:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`http://localhost:5000/api/notifications/read/${notificationId}`);
      fetchNotifications(); // Rafraîchir après marquage
    } catch (error) {
      console.error('Erreur lors du marquage comme lu:', error);
    }
  };

  return (
    <div className="container-fluid g-0">
      <Navbar />

      {/* Notifications Système */}
      <h4 className="my-4 p-3 bg-light border-start border-4 border-primary rounded m-4">
        🔔 Notifications Système
      </h4>

      {notifications.length === 0 ? (
        <div className="alert alert-info text-center m-4" role="alert">
          Aucune notification système.
        </div>
      ) : (
        notifications.map(notif => (
          <Card key={notif.id} className="m-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <Card.Title>{notif.type === 'task' ? '📋 Tâche' : 'ℹ️ Info'}</Card.Title>
                  <Card.Text className="text-muted" style={{ fontSize: '0.9rem' }}>
                    {notif.message}
                  </Card.Text>
                  <small className="text-muted">
                    Reçu le : {new Date(notif.created_at).toLocaleString()}
                  </small>
                </div>
                <div className="d-flex flex-column align-items-end">
                  {/* Bouton Voir la Tâche si type task */}
                  {notif.type === 'task' && notif.related_task_id && (
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      className="mb-2"
                      href={`/details_taches/${notif.related_task_id}`}
                    >
                      Voir la Tâche
                    </Button>
                  )}
                  {/* Bouton Marquer comme lu */}
                  {!notif.is_read && (
                    <Button 
                      variant="outline-success" 
                      size="sm"
                      onClick={() => markAsRead(notif.id)}
                    >
                      Marquer comme lu
                    </Button>
                  )}
                </div>
              </div>
            </Card.Body>
          </Card>
        ))
      )}

      {/* Rappels de Tâches */}
      <h4 className="mt-5 my-4 p-3 bg-light border-start border-4 border-success rounded m-4">
        ⏰ Rappels de Tâches
      </h4>

      {reminders.length === 0 ? (
        <div className="alert alert-info text-center m-4" role="alert">
          Aucun rappel de tâche à venir.
        </div>
      ) : (
        reminders.map(reminder => (
          <Card key={reminder.id} className="m-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <Card.Title>⏰ {reminder.title}</Card.Title>
                  <Card.Text className="text-muted" style={{ fontSize: '0.9rem' }}>
                    {reminder.message}
                  </Card.Text>
                  <small className="text-muted">
                    Échéance : {new Date(reminder.deadline).toLocaleDateString()}
                  </small>
                </div>
                <Button 
                  variant="outline-success" 
                  size="sm"
                  href={`/details_taches/${reminder.id}`}
                >
                  Voir la tâche
                </Button>
              </div>
            </Card.Body>
          </Card>
        ))
      )}
    </div>
  );
};

export default NotificationsPage;
