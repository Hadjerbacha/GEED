const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ➕ Ajouter un workflow
router.post('/', async (req, res) => {
  const { name, description, echeance, status, priorite, created_by } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO workflow (name, description, echeance, status, priorite, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description, echeance, status, priorite, created_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'ajout du workflow' });
  }
});

// 🔁 Modifier un workflow
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, echeance, status, priorite } = req.body;
  try {
    const result = await pool.query(
      `UPDATE workflow
       SET name = $1, description = $2, echeance = $3, status = $4, priorite = $5
       WHERE id = $6 RETURNING *`,
      [name, description, echeance, status, priorite, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la modification du workflow' });
  }
});

// ❌ Supprimer un workflow
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM workflow WHERE id = $1', [id]);
    res.json({ message: 'Workflow supprimé avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression du workflow' });
  }
});

// 📄 Récupérer tous les workflows avec le nombre de tâches
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.*, COUNT(t.id) AS progression
      FROM workflow w
      LEFT JOIN tasks t ON w.id = t.workflow_id
      GROUP BY w.id
      ORDER BY w.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des workflows' });
  }
});

module.exports = router;
