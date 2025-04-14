const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Configuration PostgreSQL
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

// Initialisation de la table documents
async function initializeDatabase() {
  try {
    // Créer la table documents si elle n'existe pas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        date TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('Table documents prête');
  } catch (err) {
    console.error('Erreur lors de l\'initialisation de documents:', err.stack);
  }
}

// Routes

// Récupérer tous les documents
router.get('/', auth, async (req, res) => {
  try {
    const query = `SELECT * FROM documents ORDER BY date DESC`;
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

// Ajouter un document
router.post('/', auth, upload.single('file'), async (req, res) => {
    const { name } = req.body;
  
    if (!req.file) {
      return res.status(400).json({ error: 'Fichier non téléchargé' });
    }
  
    const file_path = `/uploads/${req.file.filename}`;
  
    try {
      const query = `
        INSERT INTO documents (name, file_path) 
        VALUES ($1, $2) 
        RETURNING *;
      `;
      const values = [name, file_path];
  
      const result = await pool.query(query, values);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Erreur:', err.stack);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({
        error: 'Erreur lors de l\'ajout du document',
        details: err.message,
      });
    }
  });
  

// Supprimer un document
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Récupérer le chemin du fichier pour le supprimer du serveur
    const fileRes = await pool.query('SELECT file_path FROM documents WHERE id = $1', [id]);
    const filePath = fileRes.rows[0]?.file_path;

    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Supprimer le fichier du serveur
    }

    // Supprimer le document de la base de données
    await pool.query('DELETE FROM documents WHERE id = $1', [id]);
    res.json({ message: 'Document supprimé avec succès' });
  } catch (err) {
    console.error('Erreur:', err.stack);
    res.status(500).json({
      error: 'Erreur lors de la suppression du document',
      details: err.message
    });
  }
});

// Initialisation au démarrage
initializeDatabase();



module.exports = router;