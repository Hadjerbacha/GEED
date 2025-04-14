const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'ged',
  password: process.env.PG_PASSWORD || 'hadjer',
  port: process.env.PG_PORT || 5432,
});

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

async function initialize() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255),
      description TEXT,
      due_date DATE,
      priority VARCHAR(50),
      file_path TEXT,
      notify BOOLEAN DEFAULT false,
      assigned_to INTEGER[],
      assigned_by INTEGER,
      assignment_note TEXT,
      assigned_at TIMESTAMP,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('Table tasks prête.');
}
initialize();


  const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

router.post('/', upload.single('file'), async (req, res) => {
    const { title, description, due_date, priority, notify, assigned_to } = req.body;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;
  
    let userIds;
    try {
      userIds = JSON.parse(assigned_to);
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'assigned_to doit être un tableau JSON non vide.' });
      }
      userIds = userIds.map(Number); // Convertir les IDs en entiers
      console.log('assigned_to après conversion:', userIds);
    } catch (err) {
      return res.status(400).json({ error: 'assigned_to doit être un tableau JSON valide.' });
    }
  
    try {
      if (!userIds.every(id => Number.isInteger(id))) {
        return res.status(400).json({ error: 'Tous les IDs dans assigned_to doivent être des entiers.' });
      }
  
      // Insertion dans la base de données
      const result = await pool.query(
        `INSERT INTO tasks 
          (title, description, due_date, priority, file_path, notify, assigned_to) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [title, description, due_date, priority, file_path, notify === 'true', userIds]
      );
  
      const task = result.rows[0];
  
      // Envoi de notification après insertion si besoin
      if (notify === 'true') {
        const creator = req.user;
        await sendNotification(userIds, task, `${creator.name} ${creator.prenom}`);
      }
  
      res.status(201).json(task);
    } catch (err) {
      console.error('Error during task insertion:', err);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: err.message });
    }
  });
  
// 📥 Récupérer toutes les tâches
router.get('/', async (req, res) => {
    try {
      const tasksResult = await pool.query('SELECT * FROM tasks ORDER BY id DESC');
      const tasks = tasksResult.rows;
  
      // Récupérer tous les IDs utilisateurs uniques
      const allAssignedIds = [...new Set(tasks.flatMap(task => task.assigned_to || []))];
  
      if (allAssignedIds.length === 0) {
        return res.json(tasks);
      }
  
      // Récupérer les noms depuis la table users
      const usersResult = await pool.query(
        `SELECT id, name, prenom FROM users WHERE id = ANY($1)`,
        [allAssignedIds]
      );
      const usersMap = Object.fromEntries(usersResult.rows.map(u => [u.id, `${u.name} ${u.prenom}`]));
  
      // Remplacer les IDs dans assigned_to par les noms
      const enrichedTasks = tasks.map(task => ({
        ...task,
        assigned_names: (task.assigned_to || []).map(id => usersMap[id] || `ID ${id}`)
      }));
  
      res.json(enrichedTasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  

// ✏️ Modifier une tâche
/// ✏️ Modifier une tâche (et gérer assigned_to en optionnel)
router.put('/:id', upload.single('file'), async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    const { title, description, due_date, priority, notify, assigned_to } = req.body;
    let file_path = null;
  
    try {
      // Récupérer l'ancienne tâche
      const oldTaskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      if (oldTaskResult.rowCount === 0) {
        logger.error(`Task not found for update: ${taskId}`);
        return res.status(404).json({ message: 'Tâche non trouvée' });
      }
      const oldTask = oldTaskResult.rows[0];
  
      // Gestion du fichier
      if (req.file) {
        file_path = `/uploads/${req.file.filename}`;
        if (oldTask.file_path) {
          const oldPath = path.join(__dirname, '../', oldTask.file_path);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
      } else {
        file_path = oldTask.file_path; // On conserve l’ancien si pas de nouveau fichier
      }
  
      // Traitement des utilisateurs assignés
      let userIds = oldTask.assigned_to; // Garder les anciens par défaut
      if (assigned_to !== undefined) {
        try {
          const parsed = JSON.parse(assigned_to);
          if (!Array.isArray(parsed) || parsed.length === 0) {
            return res.status(400).json({ error: 'assigned_to doit être un tableau JSON non vide.' });
          }
          userIds = parsed.map(Number);
          if (!userIds.every(id => Number.isInteger(id))) {
            return res.status(400).json({ error: 'Tous les IDs dans assigned_to doivent être des entiers.' });
          }
        } catch (err) {
          return res.status(400).json({ error: 'assigned_to doit être un tableau JSON valide.' });
        }
      }
  
      // Mise à jour dans la base
      const result = await pool.query(
        `UPDATE tasks 
         SET title = $1, description = $2, due_date = $3, priority = $4, file_path = $5, notify = $6, assigned_to = $7
         WHERE id = $8 RETURNING *`,
        [title, description, due_date, priority, file_path, notify === 'true', userIds, taskId]
      );
  
      logger.info(`Task updated: ${taskId}`);
      res.json(result.rows[0]);
    } catch (err) {
      logger.error(`Error updating task ${taskId}: ${err.message}`);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: err.message });
    }
  });
  
  
  
router.delete('/:id', async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [taskId]);
    if (result.rowCount === 0) {
      logger.error(`Task not found: ${taskId}`);
      return res.status(404).json({ message: 'Tâche non trouvée' });
    }
    logger.info(`Task deleted: ${taskId}`);
    res.json({ message: 'Tâche supprimée' });
  } catch (err) {
    logger.error(`Error deleting task: ${err.message}`);
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// 🔄 Mettre à jour uniquement le status
router.patch('/:id/status', async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    const { status } = req.body;
  
    try {
      const result = await pool.query(
        'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
        [status, taskId]
      );
  
      if (result.rowCount === 0) {
        logger.error(`Task not found for status update: ${taskId}`);
        return res.status(404).json({ message: 'Tâche non trouvée' });
      }
  
      logger.info(`Task ${taskId} status updated to ${status}`);
      res.json(result.rows[0]);
    } catch (err) {
      logger.error(`Error updating status for task ${taskId}: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });
  
module.exports = router;
