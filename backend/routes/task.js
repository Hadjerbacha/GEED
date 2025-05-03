const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { logWorkflowAction } = require('../utils/log');
const { GoogleGenerativeAI } = require("@google/generative-ai");
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
router.post("/:id/generate-tasks", async (req, res) => {
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
    } catch (err) {
      console.error("Erreur de parsing JSON:", err);
      return res.status(500).json({ error: "Réponse mal formatée par Gemini." });
    }

    // Insertion dans la base PostgreSQL
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

    res.status(201).json({ message: "Tâches générées et enregistrées avec succès.", tasks: insertedTasks });
  } catch (error) {
    console.error("Erreur lors de la génération ou insertion :", error);
    res.status(500).json({ error: "Erreur serveur lors de la génération de tâches." });
  }
});

module.exports = router;