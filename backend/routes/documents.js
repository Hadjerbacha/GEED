const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const { auth } = require('../middleware/auth');
const router = express.Router();

// PostgreSQL Pool configuration
const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'ged',
  password: process.env.PG_PASSWORD || 'hadjer',
  port: process.env.PG_PORT || 5432,
});

// Création du dossier de stockage des fichiers
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // Limite à 50 Mo
});

// Fonction de classification des documents (par exemple, CV ou Facture)
function classifyText(text) {
  const lower = text.toLowerCase();
  if (lower.includes('facture') || lower.includes('bon') || lower.includes('montant')) return 'facture';
  if (lower.includes('curriculum vitae') || lower.includes('cv') || lower.includes('expérience')) return 'cv';
  return 'autre';
}

// Initialisation des tables de la base de données
async function initializeDatabase() {
  try {
    // Table pour les documents
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        category TEXT,
        text_content TEXT,
        date TIMESTAMP DEFAULT NOW()
      );
    `);

    // Table pour les collections
    await pool.query(`
      CREATE TABLE IF NOT EXISTS collections (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        user_id INTEGER NOT NULL, 
        date TIMESTAMP DEFAULT NOW()
      );
    `);

    // Table de liaison entre documents et collections avec les nouvelles colonnes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_collections (
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
        is_saved BOOLEAN DEFAULT FALSE,
        collection_name TEXT,
        PRIMARY KEY (document_id, collection_id)
      );
    `);

    console.log('Tables documents, collections et document_collections prêtes');
  } catch (err) {
    console.error('Erreur lors de l\'initialisation:', err.stack);
  }
}

// GET : récupérer uniquement les documents accessibles à l'utilisateur connecté
router.get('/', auth, async (req, res) => {
  const userId = req.user.id; // récupéré depuis le token

  try {
    const result = await pool.query(
      `
      SELECT d.*, dc.is_saved, dc.collection_name
      FROM documents d
      JOIN document_permissions dp ON dp.document_id = d.id
      LEFT JOIN document_collections dc ON dc.document_id = d.id
      WHERE dp.user_id = $1 AND dp.access_type = 'read'
      ORDER BY d.date DESC
      `,
      [userId]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


// POST : ajouter un document avec OCR
router.post('/', auth, upload.single('file'), async (req, res) => {
  const { name } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Fichier non téléchargé' });
  }

  const fullPath = req.file.path;
  const file_path = `/uploads/${req.file.filename}`;
  const mimeType = mime.lookup(req.file.originalname);

  try {
    let extractedText = '';

    if (mimeType === 'application/pdf') {
      const dataBuffer = fs.readFileSync(fullPath);
      const data = await pdfParse(dataBuffer);
      extractedText = data.text;
    } else if (mimeType?.startsWith('image/')) {
      const result = await Tesseract.recognize(fullPath, 'eng');
      extractedText = result.data.text;
    } else {
      return res.status(400).json({ error: 'Type de fichier non pris en charge pour l\'OCR' });
    }

    const category = classifyText(extractedText);

    const query = `
      INSERT INTO documents (name, file_path, category, text_content)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [name, file_path, category, extractedText];

    const result = await pool.query(query, values);

    res.status(201).json({
      ...result.rows[0],
      preview: extractedText.slice(0, 300) + '...'
    });
  } catch (err) {
    console.error('Erreur:', err.stack);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Erreur lors de l\'ajout', details: err.message });
  }
});

// POST : créer une collection
router.post('/collections', auth, async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nom de la collection requis' });
  }

  try {
    const query = `
      INSERT INTO collections (name, user_id)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const values = [name, req.user.id];
    const result = await pool.query(query, values);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur lors de la création de la collection:', err.stack);
    res.status(500).json({ error: 'Erreur lors de la création de la collection', details: err.message });
  }
});

// GET : récupérer toutes les collections de l'utilisateur
router.get('/collections', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM collections 
      WHERE user_id = $1
      ORDER BY date DESC
    `, [req.user.id]);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des collections:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// POST : ajouter un document à une collection avec option de nom spécifique
router.post('/collections/:collectionId/add-document', auth, async (req, res) => {
  const { collectionId } = req.params;
  const { documentId, collection_name } = req.body;

  if (!documentId) {
    return res.status(400).json({ error: 'Document ID requis' });
  }

  try {
    // Vérifier si la collection existe
    const collectionResult = await pool.query('SELECT * FROM collections WHERE id = $1', [collectionId]);
    if (collectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Collection non trouvée' });
    }

    const query = `
      INSERT INTO document_collections (document_id, collection_id, collection_name)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const values = [documentId, collectionId, collection_name || null];
    const result = await pool.query(query, values);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur lors de l\'ajout du document à la collection:', err.stack);
    res.status(500).json({ error: 'Erreur lors de l\'ajout du document', details: err.message });
  }
});

// PATCH : marquer un document comme sauvegardé dans une collection
router.patch('/collections/:collectionId/save-document/:documentId', auth, async (req, res) => {
  const { collectionId, documentId } = req.params;

  try {
    const query = `
      UPDATE document_collections 
      SET is_saved = TRUE
      WHERE document_id = $1 AND collection_id = $2
      RETURNING *;
    `;
    const values = [documentId, collectionId];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Association document-collection non trouvée' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur lors de la mise à jour:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// GET : récupérer les documents d'une collection avec les nouvelles colonnes
router.get('/collections/:collectionId/documents', auth, async (req, res) => {
  const { collectionId } = req.params;

  try {
    const result = await pool.query(`
      SELECT d.*, dc.is_saved, dc.collection_name
      FROM documents d
      JOIN document_collections dc ON dc.document_id = d.id
      WHERE dc.collection_id = $1
      ORDER BY d.date DESC
    `, [collectionId]);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des documents de la collection:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// DELETE : retirer un document d'une collection
router.delete('/collections/:collectionId/remove-document/:documentId', auth, async (req, res) => {
  const { collectionId, documentId } = req.params;

  try {
    const result = await pool.query(`
      DELETE FROM document_collections 
      WHERE document_id = $1 AND collection_id = $2
      RETURNING *;
    `, [documentId, collectionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Association document-collection non trouvée' });
    }

    res.status(200).json({ message: 'Document retiré de la collection avec succès' });
  } catch (err) {
    console.error('Erreur lors de la suppression:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// Initialisation des tables
initializeDatabase();

module.exports = router;