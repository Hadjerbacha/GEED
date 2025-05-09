import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, Button, ButtonGroup } from 'react-bootstrap';
import { jwtDecode } from 'jwt-decode';
import Navbar from './Navbar';

const NotificationsPage = () => {
  const [reminders, setReminders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [userRole, setUserRole] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  

  const handleDecision = async (id, decision, userId, senderId) => {
    try {
      // 1. Mettre à jour l'accès
      await axios.put(`http://localhost:5000/api/documents/${id}/access`, {
        access: decision, // true = approuvé, false = refusé
      });
  
      alert(`Accès ${decision ? 'approuvé' : 'refusé'} pour le document ${id}`);
  
      // 2. Envoyer une notification si approuvé
      if (decision) {
        await axios.post('http://localhost:5000/api/notifications', {
          user_id: userId,
          sender_id: senderId,
          message: `Votre demande d'accés au document ${id} a été approuvée.`,
          type: 'info',
          document_id: id,
        });
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour ou de l'envoi de la notification :", error);
    }
  };
  


  // Récupérer userId et userRole à partir du token et charger les notifications
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      setUserId(decoded.id);
      setUserRole(decoded.role); // Assure-toi que le role est bien encodé dans ton token
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
      setNotifications(res.data); // Mettre à jour les notifications récupérées
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

  // Récupérer la liste des utilisateurs
  useEffect(() => {
    fetch('http://localhost:5000/api/auth/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error('Erreur chargement utilisateurs :', err));
  }, []);

  // Associer userId au user courant
  useEffect(() => {
    if (userId && users.length > 0) {
      const found = users.find(u => u.id === userId);
      if (found) setCurrentUser(found);
    }
  }, [userId, users]);

  useEffect(() => {
    if (currentUser) {
      // Récupérer les notifications non lues
      axios.get(`http://localhost:5000/api/notifications/${currentUser.id}`)
        .then(res => {
          const unreadCount = res.data.filter(notification => !notification.is_read).length;
          setUnreadNotificationsCount(unreadCount); // Mettre à jour le nombre de notifications non lues
        })
        .catch(err => console.error("Erreur notifications :", err));
    }
  }, [currentUser]);

  

  console.log("Liste des utilisateurs:", users);
  console.log("userId:", userId, "typeof:", typeof userId);
  console.log("users[0].id typeof:", typeof users[0]?.id);
  console.log("currentUser:", currentUser);

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
                      {currentUser?.role === 'admin' && (
                        <>
                          <small className="text-muted d-block">
                            <strong>Envoyée par :</strong> {notif.sender_id || 'N/A'}
                          </small>
                          <small className="text-muted d-block">
                            <strong>Document concerné :</strong> {notif.document_id || 'N/A'}
                          </small>
                        </>
                      )}
                    </Card.Text>


                    <small className="text-muted">
                      Reçu le : {new Date(notif.created_at).toLocaleString()}
                    </small>
                    {currentUser?.role === 'admin' && (
                   <ButtonGroup>
                   <Button
                     variant="success"
                     onClick={() =>
                       handleDecision(
                         notif.document_id,        // ID du document
                         true,                     // décision (approuvé)
                         notif.sender_id,            // destinataire de la notif
                         currentUser?.id           // expéditeur = admin actuel
                       )
                     }
                   >
                     Approuver
                   </Button>
                   <Button
                     variant="danger"
                     onClick={() =>
                       handleDecision(
                         notif.document_id,
                         false,
                         notif.user_id,
                         currentUser?.id
                       )
                     }
                   >
                     Refuser
                   </Button>
                 </ButtonGroup>
                 )}
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
