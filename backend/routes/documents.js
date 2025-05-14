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

  // Système de scoring pour éviter le biais du "premier match"
  const categoryScores = {
    'contrat': 0,
    'rapport': 0,
    'mémoire': 0,
    'présentation': 0,
    'note interne': 0,
    'facture': 0,
    'cv': 0,
    'photo': 0,
  };

  // Règles de scoring par catégorie (plus il y a de mots-clés, plus le score est élevé)
  const rules = {
    'contrat': ['contrat', 'accord', 'article', 'clause', 'signature', 'parties'],
    'rapport': ['rapport', 'analyse', 'résumé', 'conclusion', 'recommandation', 'données'],
    'mémoire': ['mémoire', 'thèse', 'recherche', 'chapitre', 'bibliographie', 'hypothèse', 'matière'],
    'présentation': ['présentation', 'diapositive', 'slide', 'powerpoint', 'ppt', 'keynote'],
    'note interne': ['note', 'memo', 'interne', 'information', 'circulaire', 'compte-rendu'],
    'facture': ['facture', 'bon', 'montant', 'fournisseur', '€', 'euro', 'total à payer', 'tva'],
    'cv': ['curriculum vitae', 'cv', 'expérience', 'compétence', 'formation', 'diplôme'],
    'photo': ['photo', 'image', 'photographie', 'selfie', 'insta', 'snap', 'pixel', 'camera'],
  };

  // Calcul des scores
  for (const [category, keywords] of Object.entries(rules)) {
    keywords.forEach(keyword => {
      if (lower.includes(keyword)) {
        categoryScores[category] += 1; // +1 point par mot-clé trouvé
      }
    });
  }

  // Détection spéciale pour les photos (OCR + texte court)
  if (lower.split(/\s+/).length < 10 || /(photo|image|insta|snap|pixel)/.test(lower)) {
    categoryScores['photo'] += 3; // Bonus pour les photos
  }

  // Trouver la catégorie avec le score le plus élevé
  let bestCategory = 'autre';
  let highestScore = 0;

  for (const [category, score] of Object.entries(categoryScores)) {
    if (score > highestScore) {
      highestScore = score;
      bestCategory = category;
    }
  }

  // Seuil minimal pour éviter les faux positifs (ex: "article" seul ne signifie pas forcément "contrat")
  return highestScore >= 2 ? bestCategory : 'autre';
}

// GET : récupérer les utilisateurs ayant accès à un document spécifique
router.get('/:id/permissions', auth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.prenom, dp.access_type
      FROM document_permissions dp
      JOIN users u ON dp.user_id = u.id
      WHERE dp.document_id = $1
    `, [id]);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des permissions:', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


// Initialisation des tables de la base de données
async function initializeDatabase() {
  try {
    // Table pour les documents
  await pool.query(`
  CREATE TABLE IF NOT EXISTS document_versions (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    name TEXT,
    file_path TEXT,
    category TEXT,
    text_content TEXT,
    summary TEXT,
    tags TEXT[],
    owner_id INTEGER,
    visibility VARCHAR(20),
    ocr_text TEXT,
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

router.get('/', auth, async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin'; // Adapter selon ta logique

  try {
    let result;

    if (isAdmin) {
      // Admin : accès à tous les documents non archivés
      result = await pool.query(`
        SELECT DISTINCT d.*, dc.is_saved, dc.collection_name
        FROM documents d
        LEFT JOIN document_collections dc ON dc.document_id = d.id
        WHERE d.is_archived = false
        ORDER BY d.date DESC;
      `);
    } else {
      // Utilisateur : accès aux documents selon permissions
      result = await pool.query(`
        SELECT DISTINCT d.*, dc.is_saved, dc.collection_name
        FROM documents d
        JOIN document_permissions dp ON dp.document_id = d.id
        LEFT JOIN document_collections dc ON dc.document_id = d.id
        WHERE d.is_archived = false AND (
          dp.access_type = 'public'
          OR (dp.user_id = $1 AND dp.access_type = 'custom')
          OR (dp.user_id = $1 AND dp.access_type = 'read')
        )
        ORDER BY d.date DESC;
      `, [userId]);
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des documents :', err.stack);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// upload document
router.post('/', auth, upload.single('file'), async (req, res) => {
  let { name, access, allowedUsers, summary, tags, prio } = req.body;
  summary = summary || '';

  if (!req.file) {
    return res.status(400).json({ error: 'Fichier non téléchargé' });
  }

  const fullPath = req.file.path;
  const file_path = `/uploads/${req.file.filename}`;
  const mimeType = mime.lookup(req.file.originalname);

  try {
    let extractedText = '';

    // OCR ou parsing PDF
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

    // Classification automatique
    let finalCategory = classifyText(extractedText);

    // Vérification des versions précédentes
    const existing = await pool.query(
      'SELECT * FROM documents WHERE name = $1 ORDER BY version DESC LIMIT 1',
      [name]
    );

    let version = 1;
    let original_id = null;
    let result;
    let insertQuery;
    let insertValues;
    tags = typeof tags === 'string' ? tags.split(',') : [];



    if (existing.rowCount > 0) {
      const latestDoc = existing.rows[0];
      version = parseInt(latestDoc.version, 10) + 1;
      original_id = latestDoc.original_id || latestDoc.id;

      // Sauvegarde de l'ancienne version
      await pool.query(`
        INSERT INTO document_versions
          (document_id, version, name, file_path, category, text_content,
           summary, tags, owner_id, visibility, ocr_text, date)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
      `, [
        latestDoc.id,
        latestDoc.version,
        latestDoc.name,
        latestDoc.file_path,
        latestDoc.category,
        latestDoc.text_content,
        latestDoc.summary,
        latestDoc.tags,
        latestDoc.owner_id,
        latestDoc.visibility,
        latestDoc.ocr_text,
        latestDoc.date
      ]);
    }

    // ✅ Requête d'insertion du document (dans tous les cas)
    insertQuery = `
  INSERT INTO documents
    (name, file_path, category, text_content, summary, tags, owner_id,
     visibility, version, original_id, ocr_text, priority, access)
  VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10, $11, $12, $13)
  RETURNING *;
`;

   insertValues = [
  name,
  file_path,
  finalCategory,
  extractedText,
  summary,
  tags,
  req.user.id,
  access,            // pour visibility
  version,
  original_id,
  extractedText,
  prio,              // $12 = priority
  access             // $13 = access (boolean ou text)
];


    result = await pool.query(insertQuery, insertValues);
    const documentId = result.rows[0].id;

    // Gestion des permissions
    if (access === 'public') {
      const allUsers = await pool.query('SELECT id FROM users');
      await Promise.all(allUsers.rows.map(user =>
        pool.query(
          'INSERT INTO document_permissions (user_id, document_id, access_type) VALUES ($1, $2, $3)',
          [user.id, documentId, 'public']
        )
      ));
    } else if (access === 'custom' && Array.isArray(allowedUsers)) {
      await Promise.all(allowedUsers.map(userId =>
        pool.query(
          'INSERT INTO document_permissions (user_id, document_id, access_type) VALUES ($1, $2, $3)',
          [userId, documentId, 'custom']
        )
      ));
    } else {
      await pool.query(
        'INSERT INTO document_permissions (user_id, document_id, access_type) VALUES ($1, $2, $3)',
        [req.user.id, documentId, 'read']
      );
    }

    res.status(201).json({
      ...result.rows[0],
      preview: extractedText.slice(0, 300) + '...',
      permissions: access,
      message: version > 1 ? 'Nouvelle version enregistrée avec succès' : 'Document ajouté avec succès'
    });

  } catch (err) {
    console.error('Erreur:', err.stack);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Erreur lors de l\'ajout', details: err.message });
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
      WHERE d.id = $1 AND (dp.access_type = 'public' OR dp.user_id = $2 OR dp.access_type = 'custom') AND d.is_archived = false
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

router.post('/', async (req, res) => {
  const { text } = req.body;

  if (!text) return res.status(400).json({ error: "Texte manquant." });

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Tu es un assistant qui résume les documents de manière concise en français.",
          },
          {
            role: "user",
            content: `Voici un texte à résumer :\n${text}`,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
      }
    );

    const summary = response.data.choices[0].message.content;
    res.json({ summary });

  } catch (error) {
    console.error("Erreur OpenAI:", error.response?.data || error.message);
    res.status(500).json({ error: "Erreur lors de la génération du résumé." });
  }
});

router.put('/:id/access', async (req, res) => {
  const { id } = req.params;
  const { access } = req.body;

  try {
    // Étape 1 : récupérer le nom du document donné
    const docResult = await pool.query('SELECT name FROM documents WHERE id = $1', [id]);
    if (docResult.rowCount === 0) {
      return res.status(404).json({ message: 'Document non trouvé' });
    }

    const docName = docResult.rows[0].name;

    // Étape 2 : mettre à jour tous les documents qui ont le même nom
    const updateResult = await pool.query(
      'UPDATE documents SET access = $1 WHERE name = $2 RETURNING *',
      [access, docName]
    );

    res.status(200).json({
      message: `Accès mis à jour pour tous les documents nommés "${docName}"`,
      documents: updateResult.rows,
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'accès :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// POST /api/categories
router.post('/categories', auth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Nom de catégorie requis" });

  try {
    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0] || { message: "Catégorie déjà existante" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// POST /api/documents/check-duplicate
router.post('/check-duplicate', async (req, res) => {
  const { text_content } = req.body;
  if (!text_content) return res.status(400).json({ error: 'Texte manquant' });

  try {
    const result = await pool.query(
      'SELECT name FROM documents WHERE text_content = $1 LIMIT 1',
      [text_content]
    );

    if (result.rows.length > 0) {
      return res.json({ exists: true, documentName: result.rows[0].name });
    } else {
      return res.json({ exists: false });
    }
  } catch (err) {
    console.error('Erreur lors de la vérification du doublon:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});






// Initialisation des tables
initializeDatabase();

module.exports = router;