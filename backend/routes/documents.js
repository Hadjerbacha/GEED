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

// PostgreSQL
const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'ged',
  password: process.env.PG_PASSWORD || 'hadjer',
  port: process.env.PG_PORT || 5432,
});

// Création dossier upload
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 Mo
});

// Classification simple par mots-clés
function classifyText(text) {
  const lower = text.toLowerCase();
  if (lower.includes('facture') || lower.includes('bon') || lower.includes('montant')) return 'facture';
  if (lower.includes('curriculum vitae') || lower.includes('cv') || lower.includes('expérience')) return 'cv';
  return 'autre';
}

// Initialiser table avec colonne catégorie
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        category TEXT,
        date TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Table documents prête');
  } catch (err) {
    console.error('Erreur lors de l\'initialisation:', err.stack);
  }
}

// GET : tous les documents
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM documents ORDER BY date DESC`);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// POST : ajouter document avec OCR et classification
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
      INSERT INTO documents (name, file_path, category)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const values = [name, file_path, category];

    const result = await pool.query(query, values);

    res.status(201).json({
      ...result.rows[0],
      preview: extractedText.slice(0, 300) + '...',
    });
  } catch (err) {
    console.error('Erreur:', err.stack);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Erreur lors de l\'ajout', details: err.message });
  }
});

// DELETE : supprimer document
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    const fileRes = await pool.query('SELECT file_path FROM documents WHERE id = $1', [id]);
    const filePath = fileRes.rows[0]?.file_path;
    const fullPath = path.join(__dirname, '..', filePath);

    if (filePath && fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await pool.query('DELETE FROM documents WHERE id = $1', [id]);
    res.json({ message: 'Document supprimé avec succès' });
  } catch (err) {
    console.error('Erreur:', err.stack);
    res.status(500).json({ error: 'Erreur suppression', details: err.message });
  }
});

initializeDatabase();
module.exports = router;
