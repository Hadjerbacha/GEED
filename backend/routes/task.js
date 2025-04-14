const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth');
const router = express.Router();

const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'ged',
  password: process.env.PG_PASSWORD || 'hadjer',
  port: process.env.PG_PORT || 5432,
});

// Configuration du stockage des fichiers
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // Limite de 10 Mo
});

// Initialisation de la table tasks
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date DATE NOT NULL,
        priority VARCHAR(50) NOT NULL,
        file_path VARCHAR(255),
        notify BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        assigned_to INTEGER[],
        assigned_by INTEGER,
        assignment_note TEXT,
        assigned_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending'
      );
    `);
    
    // Ajouter la contrainte de clé étrangère si la table users existe
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
          ALTER TABLE tasks 
          ADD CONSTRAINT tasks_assigned_by_fkey 
          FOREIGN KEY (assigned_by) REFERENCES users(id);
        END IF;
      END $$;
    `);
    
    console.log('Table tasks initialisée avec succès');
  } catch (err) {
    console.error('Erreur lors de l\'initialisation de tasks:', err.stack);
  }
}

// Routes

// Créer une tâche
router.post('/', auth, upload.single('file'), async (req, res) => {
  const { title, description, due_date, priority, notify } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const query = `
      INSERT INTO tasks (
        title, description, due_date, priority, 
        file_path, notify, assigned_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      title, description, due_date, priority, 
      file_path, notify, req.user.id
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur:', err.stack);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ 
      error: 'Erreur serveur', 
      details: err.message 
    });
  }
});

// 🔹 Route: Assigner une tâche
router.post('/assign-task', auth, upload.single('file'), async (req, res) => {
  const { assignment_note, notify, assigned_to } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;
  let userIds;

  try {
    userIds = JSON.parse(assigned_to);
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: 'assigned_to doit être un tableau' });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Format invalide pour assigned_to' });
  }

  try {
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = ANY($1::int[])', 
      [userIds]
    );
    
    if (userCheck.rows.length !== userIds.length) {
      return res.status(400).json({ error: 'Un ou plusieurs utilisateurs non trouvés' });
    }

    const result = await pool.query(`
      INSERT INTO tasks (
        title, description, due_date, priority, 
        file_path, notify, assigned_to, 
        assigned_by, assignment_note, assigned_at, status
      )
      VALUES (
        'Tâche assignée', $1, NOW()::date + INTERVAL '7 days', 
        'Normale', $2, $3, $4, $5, $1, NOW(), 'assigned'
      )
      RETURNING *;
    `, [assignment_note, file_path, notify, userIds, req.user.id]);

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur:', err.stack);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Récupérer toutes les tâches
router.get('/', auth, async (req, res) => {
  try {
    const query = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.due_date,
        t.priority,
        t.file_path,
        t.notify,
        t.created_at,
        t.assigned_to,
        t.assigned_at,
        t.status,
        u.username as assigned_by_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_by = u.id
      ORDER BY t.created_at DESC
    `;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur:', err.stack);
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: err.message 
    });
  }
});


app.delete('/:id', async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [taskId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Tâche non trouvée' });
    }
    res.json({ message: 'Tâche supprimée' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});



// Initialisation au démarrage
initializeDatabase();

module.exports = router;