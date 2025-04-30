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
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  visibility VARCHAR(20) DEFAULT 'private',
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

    // Table pour les permissions des documents
    await pool.query(`
        CREATE TABLE IF NOT EXISTS document_permissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        access_type VARCHAR(20) DEFAULT 'read'
       );
    `);


    console.log('Tables documents, collections, document_collections et document_permissions prêtes');
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
      SELECT DISTINCT d.*, dc.is_saved, dc.collection_name
      FROM documents d
      JOIN document_permissions dp ON dp.document_id = d.id
      LEFT JOIN document_collections dc ON dc.document_id = d.id
      WHERE 
      dp.access_type = 'public'
      OR (dp.user_id = $1 AND dp.access_type = 'custom')
      OR ( dp.user_id = $1 AND dp.access_type = 'read')
      ORDER BY d.date DESC;
      `,
      [userId]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});



// upload document
router.post('/', auth, upload.single('file'), async (req, res) => {
  const { name, access, allowedUsers, category } = req.body;  // <-- On récupère la catégorie depuis le formulaire

  if (!req.file) {
    return res.status(400).json({ error: 'Fichier non téléchargé' });
  }

  const fullPath = req.file.path;
  const file_path = `/uploads/${req.file.filename}`;
  const mimeType = mime.lookup(req.file.originalname);

  try {
    let extractedText = '';

    // Traitement OCR ou extraction de texte selon le type de fichier
    if (mimeType === 'application/pdf') {
      const dataBuffer = fs.readFileSync(fullPath);
      const data = await pdfParse(dataBuffer);
      extractedText = data.text;  // Extraction de texte pour les fichiers PDF
    } else if (mimeType?.startsWith('image/')) {
      // Extraction de texte pour les images avec OCR
      const result = await Tesseract.recognize(fullPath, 'eng'); // 'eng' pour l'anglais, adapte selon la langue
      extractedText = result.data.text;
    } else {
      return res.status(400).json({ error: 'Type de fichier non pris en charge pour l\'OCR' });
    }

    // Petite vérification : si catégorie n’est pas envoyée par le front, on peut fallback automatiquement
    let finalCategory = category;
    if (!finalCategory || finalCategory.trim() === '') {
      finalCategory = classifyText(extractedText);  // Classifier le texte pour une catégorie automatique
    }

    // Insertion du document dans la base de données
    const insertDocQuery = `
      INSERT INTO documents (name, file_path, category, text_content, owner_id, visibility, ocr_text)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const docValues = [name, file_path, finalCategory, extractedText, req.user.id, access, extractedText];
    const result = await pool.query(insertDocQuery, docValues);
    const documentId = result.rows[0].id;

    // 🔐 Gestion des permissions
    if (access === 'public') {
      const allUsers = await pool.query('SELECT id FROM users');
      const insertPromises = allUsers.rows.map(user =>
        pool.query(
          'INSERT INTO document_permissions (user_id, document_id, access_type) VALUES ($1, $2, $3)',
          [user.id, documentId, 'public']
        )
      );
      await Promise.all(insertPromises);
    } else if (access === 'custom' && Array.isArray(allowedUsers)) {
      const insertPromises = allowedUsers.map(userId =>
        pool.query(
          'INSERT INTO document_permissions (user_id, document_id, access_type) VALUES ($1, $2, $3)',
          [userId, documentId, 'custom']
        )
      );
      await Promise.all(insertPromises);
    } else {
      // Accès privé à l'utilisateur propriétaire
      await pool.query(
        'INSERT INTO document_permissions (user_id, document_id, access_type) VALUES ($1, $2, $3)',
        [req.user.id, documentId, 'read']
      );
    }

    res.status(201).json({
      ...result.rows[0],
      preview: extractedText.slice(0, 300) + '...',  // Prévisualisation du texte extrait
      permissions: access
    });

  } catch (err) {
    console.error('Erreur:', err.stack);
    if (req.file) fs.unlink(req.file.path, () => { });  // Supprimer le fichier en cas d'erreur
    res.status(500).json({ error: 'Erreur lors de l\'ajout', details: err.message });
  }
});



//
router.post('/:id/share', auth, async (req, res) => {
  const { allowedUsers, access, newOwnerId } = req.body; // 🆕 on accepte un "newOwnerId" optionnel
  const { id } = req.params;

  try {
    if (!['public', 'custom', 'private'].includes(access)) {
      return res.status(400).json({ error: 'Type d\'accès invalide' });
    }

    // 1️⃣ Mettre à jour visibility (+ owner_id si fourni)
    if (newOwnerId) {
      await pool.query(
        `UPDATE documents SET visibility = $1, owner_id = $2 WHERE id = $3`,
        [access, newOwnerId, id]
      );
    } else {
      await pool.query(
        `UPDATE documents SET visibility = $1 WHERE id = $2`,
        [access, id]
      );
    }

    // 2️⃣ Reset des permissions
    await pool.query(`DELETE FROM document_permissions WHERE document_id = $1`, [id]);

    // 3️⃣ Recréer les permissions
    if (access === 'public') {
      const allUsers = await pool.query('SELECT id FROM users');
      const insertPromises = allUsers.rows.map(user =>
        pool.query(
          `INSERT INTO document_permissions (user_id, document_id, access_type)
           VALUES ($1, $2, $3)`,
          [user.id, id, 'public']
        )
      );
      await Promise.all(insertPromises);
    } else if (access === 'custom') {
      if (!Array.isArray(allowedUsers) || allowedUsers.length === 0) {
        return res.status(400).json({ error: 'Aucun utilisateur spécifié pour un accès personnalisé' });
      }
      const insertPromises = allowedUsers.map(userId =>
        pool.query(
          `INSERT INTO document_permissions (user_id, document_id, access_type)
           VALUES ($1, $2, $3)`,
          [userId, id, 'custom']
        )
      );
      await Promise.all(insertPromises);
    } else {
      await pool.query(
        `INSERT INTO document_permissions (user_id, document_id, access_type)
         VALUES ($1, $2, $3)`,
        [req.user.id, id, 'read']
      );
    }

    res.status(200).json({ message: 'Partage mis à jour avec succès' });

  } catch (err) {
    console.error('Erreur lors du partage:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


// GET : récupérer un document spécifique par ID
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;  // Récupérer l'ID du document depuis l'URL
  const userId = req.user.id; // Récupérer l'ID de l'utilisateur connecté depuis le token

  try {
    // Requête pour récupérer le document, vérification de l'accès selon l'utilisateur
    const result = await pool.query(`
      SELECT d.*, dp.access_type
      FROM documents d
      JOIN document_permissions dp ON dp.document_id = d.id
      WHERE d.id = $1 AND (dp.access_type = 'public' OR dp.user_id = $2 OR dp.access_type = 'custom')
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document non trouvé ou accès refusé' });
    }

    // Le document a été trouvé et l'utilisateur a l'accès approprié
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


// DELETE : supprimer un document de la base de données et du disque
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    // Vérifier si le document existe et récupérer son chemin
    const documentResult = await pool.query('SELECT file_path FROM documents WHERE id = $1', [id]);

    if (documentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    const filePath = path.join(__dirname, '..', documentResult.rows[0].file_path);

    // Supprimer le fichier du système de fichiers
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Supprimer les permissions associées au document
    await pool.query('DELETE FROM document_permissions WHERE document_id = $1', [id]);

    // Supprimer les associations avec les collections
    await pool.query('DELETE FROM document_collections WHERE document_id = $1', [id]);

    // Supprimer le document de la table documents
    await pool.query('DELETE FROM documents WHERE id = $1', [id]);

    res.status(200).json({ message: 'Document supprimé avec succès' });
  } catch (err) {
    console.error('Erreur lors de la suppression du document:', err.stack);
    res.status(500).json({ error: 'Erreur lors de la suppression', details: err.message });
  }
});


router.patch('/:id/visibility', auth, async (req, res) => {
  const documentId = req.params.id;
  const { visibility } = req.body;

  try {
    await pool.query(
      'UPDATE documents SET visibility = $1 WHERE id = $2',
      [visibility, documentId]
    );
    res.status(200).json({ message: 'Visibility mise à jour avec succès ! 🚀' });
  } catch (err) {
    console.error('Erreur:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


// 📈 Ajout des statistiques dans le backend
router.get('/stats', auth, async (req, res) => {
  try {
    const [
      userCountResult,
      documentCountResult,
      collectionCountResult,
      taskCountResult,
      workflowCountResult,
      documentPerUserResult,
      taskStatusResult
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM documents'),
      pool.query('SELECT COUNT(*) FROM collections'),
      pool.query('SELECT COUNT(*) FROM tasks'),
      pool.query('SELECT COUNT(*) FROM workflow'),
      pool.query(`
        SELECT u.id, u.name, u.prenom, COUNT(d.id) AS document_count
        FROM users u
        LEFT JOIN documents d ON u.id = d.owner_id
        GROUP BY u.id
        ORDER BY document_count DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT status, COUNT(*) AS count
        FROM tasks
        GROUP BY status
      `)
    ]);

    res.status(200).json({
      totalUsers: parseInt(userCountResult.rows[0].count, 10),
      totalDocuments: parseInt(documentCountResult.rows[0].count, 10),
      totalCollections: parseInt(collectionCountResult.rows[0].count, 10),
      totalTasks: parseInt(taskCountResult.rows[0].count, 10),
      totalWorkflows: parseInt(workflowCountResult.rows[0].count, 10),
      topDocumentOwners: documentPerUserResult.rows,
      taskStatusDistribution: taskStatusResult.rows
    });
  } catch (error) {
    console.error('Erreur récupération statistiques :', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des statistiques' });
  }
});


router.get('/stats', async (req, res) => {
  try {
    const usersResult = await pool.query('SELECT COUNT(*) FROM users');
    const documentsResult = await pool.query('SELECT COUNT(*) FROM documents');
    const tasksResult = await pool.query('SELECT COUNT(*) FROM tasks');
    const workflowsResult = await pool.query('SELECT COUNT(*) FROM workflow');
    const notificationsResult = await pool.query('SELECT COUNT(*) FROM notifications');

    res.json({
      totalUsers: parseInt(usersResult.rows[0].count, 10),
      totalDocuments: parseInt(documentsResult.rows[0].count, 10),
      totalTasks: parseInt(tasksResult.rows[0].count, 10),
      totalWorkflows: parseInt(workflowsResult.rows[0].count, 10),
      totalNotifications: parseInt(notificationsResult.rows[0].count, 10),
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// Initialisation des tables
initializeDatabase();

module.exports = router;