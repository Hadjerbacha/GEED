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

router.post('/:id/request-versions', async (req, res) => {
  const { id: documentId } = req.params;
  const userId = req.user?.id || req.body.user_id;
  if (!userId) return res.status(400).json({ message: 'Utilisateur non authentifié' });

  try {
    // Récupérer le nom du document
    const docResult = await pool.query('SELECT name FROM documents WHERE id = $1', [documentId]);
    if (docResult.rows.length === 0) {
      return res.status(404).json({ message: 'Document introuvable' });
    }

    const documentName = docResult.rows[0].name;

    // 🔧 Récupérer l'administrateur
    const adminResult = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (adminResult.rows.length === 0) {
      return res.status(404).json({ message: "Aucun administrateur trouvé." });
    }
    const adminId = adminResult.rows[0].id;

    // 🔔 Création de la notification enrichie
    const notifQuery = `
      INSERT INTO notifications (user_id,  document_id, title, message, type, is_read)
      VALUES ($1, $2, $3, $4, $5, false)
      RETURNING *`;
    const notifValues = [
      adminId,         // user_id → destinataire (admin)
      userId,          // sender_id → celui qui a fait la demande
      documentId,      // document concerné
      'Demande de consultation des versions',
      `L'utilisateur ${userId} a demandé à consulter les anciennes versions du document "${documentName}".`,
      'request'        // type utilisé côté frontend
    ];

    const notifResult = await pool.query(notifQuery, notifValues);

    res.status(201).json({ message: 'Demande envoyée à l\'administrateur', notification: notifResult.rows[0] });
  } catch (error) {
    console.error('Erreur lors de la demande de versions', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/requests', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM notifications WHERE type = 'request' ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des demandes de versions', err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});




module.exports = router;
