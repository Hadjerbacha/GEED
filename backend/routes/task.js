const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { logWorkflowAction } = require('../utils/log');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { analyzeWorkflowWithGemini } = require('./gimini');
const { getWorkflowFromDB } = require('./service');
// ➕ Ajouter un workflow
router.post('/', async (req, res) => {
  const { name, description, echeance, status, priorite, created_by, documentId } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO workflow (name, description, echeance, status, priorite, created_by, document_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, description, echeance, status, priorite, created_by, documentId]
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

function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

router.get('/:id/bpmn', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE workflow_id = $1 ORDER BY due_date ASC',
      [id]
    );

    const tasks = result.rows;

    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Aucune tâche trouvée pour ce workflow.' });
    }

    const taskPositions = tasks.map((_, i) => 200 + i * 120); // x-positions des tâches

    let bpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_${id}"
                  targetNamespace="http://bpmn.io/schema/bpmn">

  <bpmn:process id="workflow_${id}" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Début"/>`;

    tasks.forEach(task => {
      const taskTitle = escapeXml(task.title);
      bpmnXml += `\n    <bpmn:task id="Task_${task.id}" name="${taskTitle}"/>`;
    });

    bpmnXml += `\n    <bpmn:endEvent id="EndEvent_1" name="Fin"/>`;

    // Flux de séquence logique
    bpmnXml += `\n    <bpmn:sequenceFlow id="flow_start" sourceRef="StartEvent_1" targetRef="Task_${tasks[0].id}"/>`;
    for (let i = 0; i < tasks.length - 1; i++) {
      bpmnXml += `\n    <bpmn:sequenceFlow id="flow_${i}" sourceRef="Task_${tasks[i].id}" targetRef="Task_${tasks[i + 1].id}"/>`;
    }
    bpmnXml += `\n    <bpmn:sequenceFlow id="flow_end" sourceRef="Task_${tasks[tasks.length - 1].id}" targetRef="EndEvent_1"/>`;

    // BPMN Diagram
    bpmnXml += `
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_${id}">
    <bpmndi:BPMNPlane id="BPMNPlane_${id}" bpmnElement="workflow_${id}">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="100" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>`;

    tasks.forEach((task, i) => {
      const x = taskPositions[i];
      bpmnXml += `
      <bpmndi:BPMNShape id="Task_${task.id}_di" bpmnElement="Task_${task.id}">
        <dc:Bounds x="${x}" y="90" width="100" height="80"/>
      </bpmndi:BPMNShape>`;
    });

    const endX = 200 + tasks.length * 120;
    bpmnXml += `
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="${endX}" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>

      <bpmndi:BPMNEdge id="flow_start_edge" bpmnElement="flow_start">
        <di:waypoint x="136" y="118"/>
        <di:waypoint x="${taskPositions[0]}" y="130"/>
      </bpmndi:BPMNEdge>`;

    for (let i = 0; i < tasks.length - 1; i++) {
      const sourceX = taskPositions[i] + 100; // fin de la tâche
      const targetX = taskPositions[i + 1];   // début de la tâche suivante
      bpmnXml += `
      <bpmndi:BPMNEdge id="flow_${i}_edge" bpmnElement="flow_${i}">
        <di:waypoint x="${sourceX}" y="130"/>
        <di:waypoint x="${targetX}" y="130"/>
      </bpmndi:BPMNEdge>`;
    }

    bpmnXml += `
      <bpmndi:BPMNEdge id="flow_end_edge" bpmnElement="flow_end">
        <di:waypoint x="${taskPositions[taskPositions.length - 1] + 100}" y="130"/>
        <di:waypoint x="${endX}" y="118"/>
      </bpmndi:BPMNEdge>

    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

    res.set('Content-Type', 'application/xml');
    res.send(bpmnXml);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la génération BPMN.' });
  }
});

// GET /api/workflows/archives - Récupère tous les workflows archivés
router.get('/archives', authMiddleware, async (req, res) => {
  try {
    // Requête pour récupérer les archives avec des statistiques de base
    const result = await pool.query(`
      SELECT 
        wa.*,
        w.created_at as workflow_created_at,
        COUNT(t.id) as total_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'completed') as completed_tasks,
        u.name as creator_name,
        u.prenom as creator_prenom,
        d.name as document_title
      FROM 
        workflow_archive wa
        LEFT JOIN workflow w ON wa.workflow_id = w.id
        LEFT JOIN tasks t ON w.id = t.workflow_id
        LEFT JOIN users u ON wa.created_by = u.id
        LEFT JOIN documents d ON wa.document_id = d.id
      GROUP BY 
        wa.id, w.created_at, u.name, u.prenom, d.name
      ORDER BY 
        wa.completed_at DESC
    `);

    // Formater les données pour le frontend
    const archives = result.rows.map(archive => ({
      id: archive.id,
      workflow_id: archive.workflow_id,
      document_id: archive.document_id,
      document_title: archive.document_title,
      name: archive.name,
      description: archive.description,
      created_by: archive.created_by,
      creator: `${archive.creator_prenom} ${archive.creator_name}`,
      completed_at: archive.completed_at,
      validation_report: archive.validation_report,
      stats: {
        total_tasks: archive.total_tasks,
        completed_tasks: archive.completed_tasks,
        completion_rate: archive.total_tasks > 0 
          ? Math.round((archive.completed_tasks / archive.total_tasks) * 100) 
          : 0
      },
      workflow_created_at: archive.workflow_created_at,
      workflow_duration: archive.completed_at 
        ? Math.ceil((new Date(archive.completed_at) - new Date(archive.workflow_created_at)) / (1000 * 60 * 60 * 24))
        : null
    }));

    res.json(archives);
  } catch (err) {
    console.error('Erreur lors de la récupération des archives:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des archives',
      details: err.message
    });
  }
});

// routes/workflow.js (extrait)
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    // 1) Récupère le workflow
    const wfRes = await pool.query(
      'SELECT * FROM workflow WHERE id = $1',
      [id]
    );
    if (!wfRes.rowCount) {
      return res.status(404).json({ error: 'Workflow non trouvé' });
    }
    const workflow = wfRes.rows[0];

    // 2) Récupère les étapes associées
    const stepsRes = await pool.query(
      'SELECT * FROM tasks WHERE workflow_id = $1 ORDER BY due_date ASC, id ASC',
      [id]
    );
    // mappe les champs pour qu’ils correspondent à { id, name, status, … }
    const steps = stepsRes.rows.map(row => ({
      id:        row.id,
      name:      row.title,
      status:    row.status,
      // ajoute ici tout autre champ que tu veux afficher
    }));

    // 3) Renvoie l’objet attendu par le front
    return res.json({ workflow, steps });
  } catch (err) {
    console.error('GET /api/workflows/:id error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// routes/workflow.js
router.post('/:id/steps/:stepId/complete', authMiddleware, async (req, res) => {
  const { id, stepId } = req.params;
  const userId = req.user.id; // Assurez-vous que l'utilisateur est authentifié

  try {
    // Marquer l'étape comme complétée
    await pool.query(
      'UPDATE workflow_steps SET status = $1, completed_at = NOW() WHERE id = $2 AND workflow_id = $3',
      ['completed', stepId, id]
    );

    // Enregistrer le log
    const message = `Étape ${stepId} complétée par l'utilisateur ${userId}`;
    await logWorkflowAction(id, message);

    res.status(200).json({ message: 'Étape complétée avec succès.' });
  } catch (err) {
    console.error('Erreur lors de la complétion de l\'étape :', err);
    res.status(500).json({ error: 'Impossible de compléter l\'étape.' });
  }
});

// Après les autres imports
// On suppose que tu as une table `workflow_logs(workflow_id, message, timestamp)`
router.get('/:id/logs', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const logsRes = await pool.query(
      'SELECT message, timestamp FROM workflow_logs WHERE workflow_id = $1 ORDER BY timestamp DESC',
      [id]
    );
    return res.json(logsRes.rows);
  } catch (err) {
    console.error('GET /api/workflows/:id/logs error:', err);
    return res.status(500).json({ error: 'Impossible de récupérer les logs.' });
  }
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

router.post("/:id/generate-tasks", authMiddleware, async (req, res) => {
  const workflowId = req.params.id;
  const today = new Date(); // Date actuelle pour référence

  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt requis pour générer les tâches." });
    }

    // 1. Prompt amélioré avec contraintes de dates
    const constrainedPrompt = `
      Génère un tableau JSON de tâches basé sur la description suivante.
      Règles strictes :
      - Format : [{ "title": string, "description": string, "due_date": "YYYY-MM-DD" }]
      - Toutes les dates (due_date) doivent être FUTURES (après ${today.toISOString().split('T')[0]})
      - Si aucune date n'est logique, mettre "due_date": null
      
      Description: ${prompt}

      Exemple de sortie valide :
      [{
        "title": "Révision contrat",
        "description": "Vérifier les clauses 5 et 8",
        "due_date": "2024-12-15"
      }]
    `;

    // 2. Appel à Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(constrainedPrompt);
    const response = await result.response;
    const text = response.text();

    // 3. Nettoyage et validation
    const cleanedText = text.replace(/```json|```/g, "").trim();
    let tasks = [];
    
    try {
      tasks = JSON.parse(cleanedText);
      
      // Validation des dates
      tasks = tasks.map(task => {
        if (task.due_date) {
          const taskDate = new Date(task.due_date);
          if (taskDate < today) {
            console.warn(`Date corrigée : ${task.due_date} -> null (date passée)`);
            return { ...task, due_date: null };
          }
        }
        return task;
      });
    } catch (err) {
      console.error("Erreur de parsing JSON:", err);
      return res.status(500).json({ error: "Réponse mal formatée par Gemini." });
    }

    // 4. Insertion en base
    const insertedTasks = [];
    for (const task of tasks) {
      const { title, description, due_date } = task;
      const result = await pool.query(
        `INSERT INTO tasks (title, description, due_date, workflow_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [title, description || "", due_date || null, workflowId]
      );
      insertedTasks.push(result.rows[0]);
    }

    res.status(201).json({ 
      message: "Tâches générées avec succès.",
      tasks: insertedTasks,
      warnings: tasks.filter(t => !t.due_date).map(t => `"${t.title}" sans date valide`)
    });

  } catch (error) {
    console.error("Erreur lors de la génération :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Route pour analyser les logs avec Gemini
  router.post('/:id/analyze-logs', authMiddleware, async (req, res) => {
    try {

      const { workflowId } = req.params; // Récupération depuis les paramètres d'URL
    const { prompt } = req.body;

    if (!workflowId) {
      return res.status(400).json({ 
        success: false, 
        message: "Workflow ID est requis" 
      });
    }
      
      // Récupération du workflow
      const workflow = await getWorkflowFromDB(workflowId);
  
      // Analyse avec Gemini
      const analysis = await analyzeWorkflowWithGemini(prompt, {
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        stepsCount: workflow.steps.length
      });
  
      res.json({ 
        success: true,
        analysis: analysis
      });
      
    } catch (error) {
      console.error('Erreur analyse logs:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Échec de l'analyse des logs"
      });
    }
  });

  // Route pour mettre à jour le statut d'un workflow
router.patch('/:id/status', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // Validation du statut
  const allowedStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ 
      error: 'Statut invalide', 
      allowedStatuses: allowedStatuses 
    });
  }

  try {
// Mise à jour du statut
const result = await pool.query(
  `UPDATE workflow SET status = $1 WHERE id = $2 RETURNING *`,
  [status, id]
);

// Archivage automatique si le workflow est terminé
if (status === 'completed') {
  // Générer un rapport automatique
  const report = `Workflow terminé le ${new Date().toLocaleDateString()}`;
  
  await pool.query(
    `INSERT INTO workflow_archive
     (workflow_id, name, description, document_id, created_by, completed_at, validation_report)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
    [
      id,
      result.rows[0].name,
      result.rows[0].description,
      result.rows[0].document_id,
      req.user.id,
      report
    ]
  );

  // Marquer le document comme archivé
  await pool.query(
    'UPDATE documents SET is_archived = true WHERE id = $1',
    [result.rows[0].document_id]
  );
}

res.json(result.rows[0]);
} catch (err) {
console.error('Erreur:', err);
res.status(500).json({ error: 'Erreur serveur' });
}
});

router.get('/document/:documentId', authMiddleware, async (req, res) => {
  const { documentId } = req.params;
  
  // Validation simple
  if (!documentId || isNaN(documentId)) {
    return res.status(400).json({ message: 'ID de document invalide' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM workflow WHERE document_id = $1 LIMIT 1', // Note: 'workflows' au pluriel?
      [documentId]
    );
    
    if (result.rows.length > 0) {
      res.json({ 
        exists: true, 
        workflow: result.rows[0] 
      });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error('Erreur DB:', err);
    res.status(500).json({ 
      message: 'Erreur serveur',
      error: err.message // Ajoutez ceci pour le débogage
    });
  }
});

// GET /api/workflows/:id/tasks - Récupère toutes les tâches d'un workflow spécifique
router.get('/:id/tasks', authMiddleware, async (req, res) => {
  const { id } = req.params;
  
  try {
    // 1. Vérifier que le workflow existe
    const workflowRes = await pool.query(
      'SELECT id FROM workflow WHERE id = $1', 
      [id]
    );
    
    if (workflowRes.rowCount === 0) {
      return res.status(404).json({ error: 'Workflow non trouvé' });
    }

    // 2. Récupérer les tâches avec les informations des utilisateurs assignés
    const tasksRes = await pool.query(
      `SELECT 
        t.id,
        t.title,
        t.description,
        t.due_date,
        t.priority,
        t.status,
        t.file_path,
        t.assigned_to,
        t.created_at,
        t.assignment_note,
        jsonb_agg(
          jsonb_build_object(
            'id', u.id,
            'name', u.name,
            'prenom', u.prenom,
            'email', u.email
          )
        ) FILTER (WHERE u.id IS NOT NULL) as assigned_users
       FROM tasks t
       LEFT JOIN unnest(t.assigned_to) WITH ORDINALITY AS a(user_id, ord) ON true
       LEFT JOIN users u ON u.id = a.user_id
       WHERE t.workflow_id = $1
       GROUP BY t.id
       ORDER BY 
         CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
         t.due_date ASC,
         t.id ASC`,
      [id]
    );

    // 3. Formater la réponse
    const tasks = tasksRes.rows.map(task => ({
      ...task,
      due_date: task.due_date ? new Date(task.due_date).toISOString() : null,
      assigned_users: task.assigned_users || []
    }));

    res.json(tasks);
    
  } catch (err) {
    console.error('Erreur dans GET /api/workflows/:id/tasks:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des tâches',
      details: err.message 
    });
  }
});

// Route PATCH pour mettre à jour partiellement un workflow
router.patch('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Vérifier d'abord si le workflow existe
    const checkRes = await pool.query(
      'SELECT * FROM workflow WHERE id = $1',
      [id]
    );
    
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'Workflow non trouvé' });
    }

    // Construire dynamiquement la requête de mise à jour
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Liste des champs autorisés à être mis à jour
    const allowedFields = ['name', 'description', 'echeance', 'status', 'priorite'];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    // Si aucun champ valide n'a été fourni
    if (fields.length === 0) {
      return res.status(400).json({ 
        error: 'Aucun champ valide fourni pour la mise à jour',
        allowedFields: allowedFields
      });
    }

    // Ajouter la date de mise à jour
    fields.push(`updated_at = NOW()`);

    // Construire et exécuter la requête finale
    const queryText = `
      UPDATE workflow
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    values.push(id);

    const result = await pool.query(queryText, values);
    
    // Enregistrer l'action dans les logs
    const user = req.user; // Récupéré depuis authMiddleware
    const message = `Workflow mis à jour par ${user.name} ${user.prenom}`;
    await logWorkflowAction(id, message);

    res.json({
      success: true,
      workflow: result.rows[0],
      message: 'Workflow mis à jour avec succès'
    });

  } catch (err) {
    console.error('Erreur lors de la mise à jour du workflow:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour du workflow',
      details: err.message 
    });
  }
});

// routes/task.js
router.post('/:id/archive', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { validation_report } = req.body;

  try {
     // Vérifier si déjà archivé
     const existingArchive = await pool.query(
      'SELECT * FROM workflow_archive WHERE workflow_id = $1',
      [id]
    );
    
    if (existingArchive.rowCount > 0) {
      return res.status(400).json({ error: 'Ce workflow est déjà archivé' });
    }

    // 1. Vérifier que le workflow est terminé
    const workflowRes = await pool.query(
      'SELECT * FROM workflow WHERE id = $1 AND status = $2',
      [id, 'completed']
    );

    if (workflowRes.rowCount === 0) {
      return res.status(400).json({ error: 'Le workflow doit être terminé pour être archivé' });
    }

    // 2. Créer l'archive
    const archiveRes = await pool.query(
      `INSERT INTO workflow_archive 
       (workflow_id, name, description, document_id, created_by, completed_at, validation_report)
       SELECT id, name, description, document_id, created_by, NOW(), $1
       FROM workflow WHERE id = $2 RETURNING *`,
      [validation_report, id]
    );

    // 3. Marquer le document comme archivé (optionnel)
    await pool.query(
      'UPDATE documents SET is_archived = true WHERE id = $1',
      [workflowRes.rows[0].document_id]
    );

    res.json(archiveRes.rows[0]);
  } catch (err) {
    console.error('Erreur lors de l\'archivage:', err);
    res.status(500).json({ error: 'Erreur lors de l\'archivage' });
  }
});

module.exports = router;