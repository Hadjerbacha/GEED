const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Utilisation de pg pour PostgreSQL
const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'ged',
  password: process.env.PG_PASSWORD || 'hadjer',
  port: process.env.PG_PORT || 5432,
});

// Ajouter une nouvelle notification
router.post('/', async (req, res) => {
  const { user_id, message, type, related_task_id } = req.body;

  if (!user_id || !message) {
    return res.status(400).json({ message: 'user_id et message sont obligatoires' });
  }

  // Assurez-vous que user_id est un entier
  const parsedUserId = parseInt(user_id, 10);  // On transforme user_id en entier

  if (isNaN(parsedUserId)) {
    return res.status(400).json({ message: 'user_id doit être un entier valide' });
  }

  // Assurez-vous que related_task_id est un entier ou null
  const parsedRelatedTaskId = related_task_id ? parseInt(related_task_id, 10) : null;

  if (related_task_id && isNaN(parsedRelatedTaskId)) {
    return res.status(400).json({ message: 'related_task_id doit être un entier valide' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO notifications (user_id, message, type, related_task_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [parsedUserId, message, type || 'info', parsedRelatedTaskId]
    );
    res.status(201).json(result.rows[0]);  // Retourne la notification ajoutée
  } catch (err) {
    console.error('Erreur lors de l\'ajout de la notification', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Récupérer les notifications d'un utilisateur
router.get('/:user_id', async (req, res) => {
  const { user_id } = req.params;

  // Assurez-vous que user_id est un entier
  const parsedUserId = parseInt(user_id, 10);

  if (isNaN(parsedUserId)) {
    return res.status(400).json({ message: 'user_id doit être un entier valide' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [parsedUserId]
    );
    res.status(200).json(result.rows);  // Retourne la liste des notifications
  } catch (err) {
    console.error('Erreur lors de la récupération des notifications', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Mettre à jour le statut de lecture d'une notification
router.put('/read/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Marquer la notification comme lue
    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Notification non trouvée' });
    }

    res.status(200).json({ message: 'Notification marquée comme lue' });
  } catch (err) {
    console.error('Erreur lors de la mise à jour de la notification', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
