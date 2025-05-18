const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { logWorkflowAction } = require('../utils/log');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { analyzeWorkflowWithGemini } = require('./gimini');
const { getWorkflowFromDB } = require('./service');
const { assignTasksAutomatically} = require('../controllers/authController');


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

    let currentX = 200;
const taskPositions = [];

tasks.forEach((task, index) => {
  taskPositions.push(currentX);
  // Si c'est une tâche de validation, prévoir un espace pour la gateway (ex: +150)
  if (task.type === 'validation') {
    currentX += 250; // +100 pour la tâche +150 pour la gateway
  } else {
    currentX += 120; // distance normale
  }
});


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

    // Ajouter les tâches
    tasks.forEach(task => {
      const taskTitle = escapeXml(task.title);
      bpmnXml += `\n    <bpmn:task id="Task_${task.id}" name="${taskTitle}"/>`;
    });

    bpmnXml += `\n    <bpmn:endEvent id="EndEvent_1" name="Fin"/>`;

    // Ajouter les XOR gateways pour les tâches conditionnelles
    tasks.forEach((task, index) => {
      if (task.type === 'validation') {
        const gatewayId = `Gateway_${task.id}`;
        
        // Ajouter le gateway XOR
        bpmnXml += `\n    <bpmn:exclusiveGateway id="${gatewayId}" name="Décision ${index + 1}"/>`;
        
        // Ajouter les séquences flows conditionnels
        bpmnXml += `\n    <bpmn:sequenceFlow id="flow_${task.id}_approved" sourceRef="${gatewayId}" targetRef="Task_${task.id}">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${approved == true}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>`;
        
        bpmnXml += `\n    <bpmn:sequenceFlow id="flow_${task.id}_rejected" sourceRef="${gatewayId}" targetRef="EndEvent_1">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${approved == false}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>`;
      }
    });

    // Flux de séquence logique
    bpmnXml += `\n    <bpmn:sequenceFlow id="flow_start" sourceRef="StartEvent_1" targetRef="Task_${tasks[0].id}"/>`;
    
    for (let i = 0; i < tasks.length - 1; i++) {
      const currentTask = tasks[i];
      const nextTask = tasks[i + 1];
      
      if (currentTask.type === 'validation') {
        // Pour les tâches de validation, le flux va vers le gateway
        bpmnXml += `\n    <bpmn:sequenceFlow id="flow_${i}" sourceRef="Task_${currentTask.id}" targetRef="Gateway_${currentTask.id}"/>`;
      } else {
        // Pour les tâches normales, flux direct vers la suivante
        bpmnXml += `\n    <bpmn:sequenceFlow id="flow_${i}" sourceRef="Task_${currentTask.id}" targetRef="Task_${nextTask.id}"/>`;
      }
    }
    
    // Dernier flux (sans condition)
    bpmnXml += `\n    <bpmn:sequenceFlow id="flow_end" sourceRef="Task_${tasks[tasks.length - 1].id}" targetRef="EndEvent_1"/>`;

    // BPMN Diagram
    bpmnXml += `
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_${id}">
    <bpmndi:BPMNPlane id="BPMNPlane_${id}" bpmnElement="workflow_${id}">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="100" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>`;

    // Positionnement des éléments
    tasks.forEach((task, i) => {
      const x = taskPositions[i];
      bpmnXml += `
      <bpmndi:BPMNShape id="Task_${task.id}_di" bpmnElement="Task_${task.id}">
        <dc:Bounds x="${x}" y="90" width="100" height="80"/>
      </bpmndi:BPMNShape>`;
      
      // Ajouter le gateway si c'est une tâche de validation
      if (task.type === 'validation') {
        const gatewayX = x + 150;
        bpmnXml += `
      <bpmndi:BPMNShape id="Gateway_${task.id}_di" bpmnElement="Gateway_${task.id}" isMarkerVisible="true">
        <dc:Bounds x="${gatewayX}" y="105" width="50" height="50"/>
      </bpmndi:BPMNShape>`;
      }
    });

    const endX = currentX;

    bpmnXml += `
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="${endX}" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>`;

    // Connexions
    bpmnXml += `
      <bpmndi:BPMNEdge id="flow_start_edge" bpmnElement="flow_start">
        <di:waypoint x="136" y="118"/>
        <di:waypoint x="${taskPositions[0]}" y="130"/>
      </bpmndi:BPMNEdge>`;

    for (let i = 0; i < tasks.length - 1; i++) {
      const currentTask = tasks[i];
      const nextTask = tasks[i + 1];
      
      if (currentTask.type === 'validation') {
        // Flèche de la tâche vers le gateway
        const sourceX = taskPositions[i] + 100;
        const gatewayX = taskPositions[i] + 150;
        bpmnXml += `
      <bpmndi:BPMNEdge id="flow_${i}_edge" bpmnElement="flow_${i}">
        <di:waypoint x="${sourceX}" y="130"/>
        <di:waypoint x="${gatewayX}" y="130"/>
      </bpmndi:BPMNEdge>`;
        
        // Flèches du gateway vers les options
        bpmnXml += `
      <bpmndi:BPMNEdge id="flow_${i}_approved_edge" bpmnElement="flow_${currentTask.id}_approved">
        <di:waypoint x="${gatewayX + 50}" y="130"/>
        <di:waypoint x="${taskPositions[i + 1]}" y="130"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_${i}_rejected_edge" bpmnElement="flow_${currentTask.id}_rejected">
        <di:waypoint x="${gatewayX + 25}" y="155"/>
        <di:waypoint x="${endX}" y="155"/>
        <di:waypoint x="${endX}" y="118"/>
      </bpmndi:BPMNEdge>`;
      } else {
        // Flèche normale entre tâches
        const sourceX = taskPositions[i] + 100;
        const targetX = taskPositions[i + 1];
        bpmnXml += `
      <bpmndi:BPMNEdge id="flow_${i}_edge" bpmnElement="flow_${i}">
        <di:waypoint x="${sourceX}" y="130"/>
        <di:waypoint x="${targetX}" y="130"/>
      </bpmndi:BPMNEdge>`;
      }
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

    // Dans la route /:id/bpmn
tasks.forEach((task, index) => {
  // Modifier la partie des gateways comme ceci :
if (task.type === 'validation' || task.status === 'cancelled') {
  const gatewayId = `Gateway_${task.id}`;
  
  // Ajouter le gateway XOR
  bpmnXml += `\n    <bpmn:exclusiveGateway id="${gatewayId}" name="Décision ${index + 1}"/>`;
  
  // Flux pour approbation (si validation)
  if (task.type === 'validation') {
    bpmnXml += `\n    <bpmn:sequenceFlow id="flow_${task.id}_approved" sourceRef="${gatewayId}" targetRef="Task_${task.id}">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${approved == true}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>`;
  }
  
  // Flux pour annulation
  bpmnXml += `\n    <bpmn:sequenceFlow id="flow_${task.id}_cancelled" sourceRef="${gatewayId}" targetRef="Task_Reassign_${task.id}">
    <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${status == 'cancelled'}</bpmn:conditionExpression>
  </bpmn:sequenceFlow>`;
  
  // Flux par défaut (si ni approuvé ni annulé)
  bpmnXml += `\n    <bpmn:sequenceFlow id="flow_${task.id}_default" sourceRef="${gatewayId}" targetRef="EndEvent_1">
    <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${approved == false &amp;&amp; status != 'cancelled'}</bpmn:conditionExpression>
  </bpmn:sequenceFlow>`;
  
  // Ajouter une tâche de réassignation
  bpmnXml += `\n    <bpmn:task id="Task_Reassign_${task.id}" name="Réassigner ${escapeXml(task.title)}"/>`;
  
  // Flux de la tâche de réassignation vers la tâche originale
  bpmnXml += `\n    <bpmn:sequenceFlow id="flow_reassign_${task.id}" sourceRef="Task_Reassign_${task.id}" targetRef="Task_${task.id}"/>`;
}
});

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la génération BPMN.' });
  }
});

// Modifier la route de réassignation :
// Modifier la route comme ceci :
router.post('/:workflowId/tasks/:taskId/reassign', authMiddleware, async (req, res) => {
  const { workflowId, taskId } = req.params;
  const { newAssigneeId, reason } = req.body;
  const userId = req.user.id;

  try {
    // 1. Vérifier que la tâche existe et appartient au workflow
    const taskRes = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND workflow_id = $2',
      [taskId, workflowId]
    );

    if (taskRes.rowCount === 0) {
      return res.status(404).json({ error: 'Tâche non trouvée dans ce workflow' });
    }

    // 2. Vérifier que le nouvel assigné existe
    const userRes = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [newAssigneeId]
    );

    if (userRes.rowCount === 0) {
      return res.status(400).json({ error: 'Utilisateur assigné non trouvé' });
    }

    // 3. Mettre à jour la tâche avec le nouveau statut
    await pool.query(
      `UPDATE tasks 
       SET 
         assigned_to = $1,
         status = 'pending', // Réinitialiser le statut
         assignment_note = COALESCE(assignment_note, '') || $2,
         updated_at = NOW()
       WHERE id = $3`,
      [[newAssigneeId], `\nRéassignée le ${new Date().toLocaleString()} par ${userId}. Raison: ${reason || 'non spécifiée'}\n`, taskId]
    );

    // 4. Journaliser l'action
    await logWorkflowAction(
      workflowId,
      `Tâche ${taskId} réassignée à ${newAssigneeId} par ${userId}`,
      'reassignment'
    );

    res.json({ success: true, message: 'Tâche réassignée avec succès' });

  } catch (err) {
    console.error('Erreur de réassignation:', err);
    res.status(500).json({ error: 'Erreur lors de la réassignation' });
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
// Exemple : POST /api/workflows/:id/generate-tasks
router.post("/:id/generate-tasks", authMiddleware, async (req, res) => {
  const workflowId = req.params.id;

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt requis pour générer les tâches." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Nettoyage du texte Gemini (enlève ```json et ```)
    const cleanedText = text.replace(/```json|```/g, "").trim();

    // Parsing JSON
    let tasks = [];
    try {
      tasks = JSON.parse(cleanedText);
      
      // Marquer certaines tâches comme validation
      tasks.forEach(task => {
        if (task.title.toLowerCase().includes('validation') || task.title.toLowerCase().includes('approval')) {
          task.type = 'validation';
        } else {
          task.type = 'operation';
        }
      });
    } catch (err) {
      console.error("Erreur de parsing JSON:", err);
      return res.status(500).json({ error: "Réponse mal formatée par Gemini." });
    }

    // Insertion dans la base PostgreSQL
    const insertedTasks = [];

    for (const task of tasks) {
      const { title, description, due_date, type } = task;

      const result = await pool.query(
        `INSERT INTO tasks (title, description, due_date, workflow_id, type)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [title, description || "", due_date || null, workflowId, type || 'operation']
      );

      insertedTasks.push(result.rows[0]);
    }

    res.status(201).json({ message: "Tâches générées et enregistrées avec succès.", tasks: insertedTasks });
  } catch (error) {
    console.error("Erreur lors de la génération ou insertion :", error);
    res.status(500).json({ error: "Erreur serveur lors de la génération de tâches." });
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


router.post("/:id/assign-tasks", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params; // ID du workflow
    const userId = req.user.id; // ID de l'utilisateur authentifié

    // 1. Vérifier que l'utilisateur a le droit d'assigner des tâches
    const userCheck = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0 || !['admin', 'manager'].includes(userCheck.rows[0].role)) {
      return res.status(403).json({ 
        success: false,
        message: "Permission refusée" 
      });
    }

    // 2. Récupérer les tâches non assignées de ce workflow
   const tasksResult = await pool.query(
  `SELECT * FROM tasks 
   WHERE workflow_id = $1 
   AND (assigned_to IS NULL OR cardinality(assigned_to) = 0)`,
  [id]
);

    
    const tasks = tasksResult.rows;
    
    if (!tasks || tasks.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "Aucune tâche à assigner" 
      });
    }

    // 3. Récupérer les stats des utilisateurs
    const usersStats = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.prenom,
        u.role,
        COALESCE(SUM(s.duration), 0) as total_duration
      FROM users u
      LEFT JOIN sessions s ON u.id = s.user_id
      GROUP BY u.id
      ORDER BY total_duration ASC
    `);

    // 4. Préparer les utilisateurs disponibles par rôle
    const availableUsers = {
      employe: usersStats.rows.filter(u => u.role === 'employe'),
      directeur: usersStats.rows.find(u => u.role === 'directeur'),
      manager: usersStats.rows.filter(u => u.role === 'manager')
    };

    // 5. Assigner les tâches
    const assignments = [];
    
    for (const task of tasks) {
      try {
        let assignedUser = null;
        
        // Tâches de validation -> Directeur
        if (task.title.toLowerCase().includes('validation') || task.type === 'validation') {
          assignedUser = availableUsers.directeur;
        } 
        // Tâches de gestion -> Manager
        else if (task.title.toLowerCase().includes('gestion') || task.type === 'management') {
          assignedUser = availableUsers.manager.length > 0 
            ? availableUsers.manager[0] 
            : null;
        }
        // Tâches normales -> Employé le moins occupé
        else {
          assignedUser = availableUsers.employe.length > 0 
            ? availableUsers.employe[0] 
            : null;
        }

        if (assignedUser) {
          await pool.query(
  `UPDATE tasks SET assigned_to = $1 WHERE id = $2`,
  [[assignedUser.id], task.id]
);

          
          assignments.push({
            taskId: task.id,
            taskTitle: task.title,
            assignedTo: assignedUser.id,
            assignedName: `${assignedUser.prenom} ${assignedUser.name}`
          });

          // Mettre à jour la liste des disponibles (rotation)
          if (!['directeur', 'manager'].includes(assignedUser.role)) {
            availableUsers.employe.push(availableUsers.employe.shift());
          }
        }
      } catch (taskErr) {
        console.error(`Erreur sur la tâche ${task.id}:`, taskErr);
      }
    }

    // 6. Retourner le résultat
    if (assignments.length > 0) {
      return res.json({
        success: true,
        message: `${assignments.length}/${tasks.length} tâches assignées`,
        assignments
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Aucune tâche n'a pu être assignée"
      });
    }

  } catch (err) {
    console.error("Erreur dans l'assignation automatique:", err);
    return res.status(500).json({ 
      success: false,
      message: "Erreur serveur lors de l'assignation",
      error: err.message
    });
  }
});


module.exports = router;