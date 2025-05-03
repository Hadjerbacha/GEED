// WorkflowPage.js
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Button, Badge, Spinner, Modal, Form } from 'react-bootstrap';
import Select from 'react-select';
import { motion } from 'framer-motion';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useUpdateNodeInternals
} from 'reactflow';
import 'reactflow/dist/style.css';
import Navbar from './Navbar';
import Chatbot from './chatbot';
import { toast } from 'react-toastify';

// Helper pour formatage durée
const formatDuration = ms => {
  const sec = Math.floor(ms/1000)%60;
  const min = Math.floor(ms/60000)%60;
  const h   = Math.floor(ms/3600000);
  return `${h}h ${min}m ${sec}s`;
};

export default function WorkflowPage() {
  const { id } = useParams();
  const location = useLocation();
  const document = location.state?.document;
  const [workflow, setWorkflow] = useState(null);
  const [steps, setSteps] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  // Pour la création/édition de tâches
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', due_date: '', priority: 'moyenne', assigned_to: []
  });
  const [users, setUsers] = useState([]);

  // Charger workflow + étapes + résumé IA + logs
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wfRes, logRes, sumRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/workflows/${id}`, { headers:{Authorization:`Bearer ${token}`} }),
        axios.get(`http://localhost:5000/api/workflows/${id}/logs`, { headers:{Authorization:`Bearer ${token}`} })]);
      setWorkflow(wfRes.data.workflow);
      setSteps(wfRes.data.steps);
      setLogs(logRes.data);
      setSummary(sumRes.data.summary);
    } catch (err) {
      console.error(err);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [id, document, token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    axios.get('http://localhost:5000/api/auth/users', { headers:{Authorization:`Bearer ${token}`} })
      .then(r=> setUsers(r.data))
      .catch(()=> toast.error('Impossible de charger les utilisateurs'));
  }, [token]);

  
  // Générer nodes & edges
  useEffect(() => {
    if (!steps.length) return;
    const n = steps.map((s,i) => ({
      id: String(s.id),
      type: i===0?'input': i===steps.length-1?'output':'default',
      position:{ x: 100 + i*250, y: 100 + (i%2)*150 },
      data:{ label:`${s.name}\n(${s.status})` }
    }));
    const e = steps.slice(1).map((s,i)=>({
      id:`e${steps[i].id}-${s.id}`,
      source:String(steps[i].id),
      target:String(s.id),
      animated:true
    }));
    setNodes(n);
    setEdges(e);
  }, [steps]);

  // Compléter étape
  const completeStep = async (step) => {
    try {
      await axios.post(`http://localhost:5000/api/workflows/${id}/steps/${step.id}/complete`, {}, { headers:{Authorization:`Bearer ${token}`} });
      toast.success(`Étape "${step.name}" complétée`);
      fetchAll();
    } catch {
      toast.error('Impossible de compléter');
    }
  };

  if (loading) return <Spinner animation="border" className="m-5"/>;

  // Pour créer
const openCreateTask = () => {
    setEditingTask(null);
    setTaskForm({ title:'', description:'', due_date:'', priority:'moyenne', assigned_to:[] });
    setShowTaskModal(true);
  };
  // Pour éditer
  const openEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description,
      due_date: task.due_date?.slice(0,10) || '',
      priority: task.priority || 'moyenne',
      assigned_to: task.assigned_to || []
    });
    setShowTaskModal(true);
  };


  const handleSaveTask = async () => {
    try {
      const payload = { ...taskForm, workflow_id: id, assigned_to: JSON.stringify(taskForm.assigned_to) };
      let res;
      if (editingTask) {
        // PUT existante
        res = await axios.put(`http://localhost:5000/api/tasks/${editingTask.id}`, payload, { headers:{Authorization:`Bearer ${token}`} });
        toast.success('Tâche mise à jour');
      } else {
        // POST nouvelle
        res = await axios.post('http://localhost:5000/api/tasks', payload, { headers:{Authorization:`Bearer ${token}`} });
        toast.success('Tâche créée');
      }
      setShowTaskModal(false);
      fetchAll();  // recharge steps
    } catch {
      toast.error('Erreur lors de la sauvegarde de la tâche');
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm('Supprimer cette tâche ?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/tasks/${taskId}`, { headers:{Authorization:`Bearer ${token}`} });
      toast.success('Tâche supprimée');
      fetchAll();
    } catch {
      toast.error('Erreur suppression tâche');
    }
  };
// Fonction pour générer des tâches automatiquement
const generateTasks = async () => {
    try {
      // Crée un prompt basé sur le nom et la description du workflow
      const prompt = `Voici le nom d’un workflow : ${workflow.name}
  et sa description : ${workflow.description}.
  Génère une liste de tâches au format JSON, chaque tâche doit avoir les champs suivants : title, description et due_date.`;
  
      console.log("🔍 Prompt envoyé à Gemini:", prompt);
  
      const response = await axios.post(
        `http://localhost:5000/api/workflows/${id}/generate-tasks`,
        { prompt },
        { headers: { Authorization: `Bearer ${token}` } }
      );
  
      console.log("✅ Réponse de l'API :", response.data);
  
      toast.success('Tâches générées avec succès');
      fetchAll(); // Rafraîchir les données des tâches
    } catch (error) {
      console.error("❌ Erreur lors de la génération des tâches :", error);
  
      if (error.response) {
        console.error("🛑 Réponse du serveur :", error.response.data);
      }
  
      toast.error('Erreur lors de la génération des tâches');
    }
  };
  
  
  
  return (
    <>
      <Navbar/>
      <Chatbot/>
      <div className="p-4">
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.5}}>
        <h2>Workflow: {workflow?.name || 'Chargement...'}</h2>
          <Button variant="primary" onClick={generateTasks}>Générer des tâches automatiques</Button>
        
          <p><strong>Statut:</strong> <Badge bg={workflow.status==='completed'?'success':'primary'}>{workflow.status}</Badge></p>
          <p><strong>Résumé IA:</strong> {summary}</p>
          <div style={{height:400, border:'1px solid #aaa', borderRadius:8}}>
            <ReactFlow nodes={nodes} edges={edges} fitView>
              <MiniMap/>
              <Controls/>
              <Background color="#888" gap={16}/>
            </ReactFlow>
          </div>
          <div className="d-flex justify-content-between align-items-center mb-2">
  <h4>Étapes</h4>
  <Button size="sm" onClick={openCreateTask}>+ Nouvelle tâche</Button>
</div>

{steps.map(s => (
  <div key={s.id} className="d-flex align-items-center mb-2">
    <Badge bg={s.status==='completed'?'success':'secondary'}>{s.name}</Badge>
    <span className="ms-3">Statut: {s.status}</span>
    <span className="ms-3 text-muted">Échéance: {s.due_date?.slice(0,10)||'–'}</span>
    <span className="ms-3 text-muted">Priorité: {s.priority}</span>
    <span className="ms-3 text-muted">Assignés: {s.assigned_to?.join(', ')}</span>
    {s.status==='pending' && (
      <Button size="sm" className="ms-auto me-1" onClick={()=>completeStep(s)}>Terminer</Button>
    )}
    <Button size="sm" variant="outline-secondary" className="me-1" onClick={()=>openEditTask(s)}>✏️</Button>
    <Button size="sm" variant="outline-danger" onClick={()=>deleteTask(s.id)}>🗑️</Button>
  </div>
))}

          <Button variant="info" onClick={()=>setShowLogModal(true)}>Voir Audit Log</Button>{' '}
          <Button variant="secondary" className="mt-3" onClick={()=>navigate(-1)}>← Retour</Button>
        </motion.div>
      </div>

      {/* Modal audit log */}
    <Modal
  size="lg"
  show={showLogModal}
  onHide={() => setShowLogModal(false)}
  dialogClassName="custom-modal"
  centered
  style={{ zIndex: 1050, width: '100%' }}
>
  <Modal.Header closeButton>
    <Modal.Title>Audit Log</Modal.Title>
  </Modal.Header>
  <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
    {logs.length > 0 ? (
      logs.map((log, index) => (
        <div key={index} className="mb-2">
          <small className="text-muted">
            {new Date(log.timestamp).toLocaleString()}
          </small>
          <p>{log.message}</p>
        </div>
      ))
    ) : (
      <p className="text-muted">Aucun log disponible pour ce workflow.</p>
    )}
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => setShowLogModal(false)}>
      Fermer
    </Button>
  </Modal.Footer>
</Modal>

      <Modal show={showTaskModal} onHide={()=>setShowTaskModal(false)} style={{ zIndex: 1050, width: '100%' }}>
  <Modal.Header closeButton>
    <Modal.Title>{editingTask?'Éditer':'Nouvelle'} tâche</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    <Form>
      <Form.Group className="mb-2">
        <Form.Label>Titre</Form.Label>
        <Form.Control
          value={taskForm.title}
          onChange={e=>setTaskForm(f=>({...f,title:e.target.value}))}
        />
      </Form.Group>
      <Form.Group className="mb-2">
        <Form.Label>Description</Form.Label>
        <Form.Control as="textarea" rows={2}
          value={taskForm.description}
          onChange={e=>setTaskForm(f=>({...f,description:e.target.value}))}
        />
      </Form.Group>
      <Form.Group className="mb-2">
        <Form.Label>Échéance</Form.Label>
        <Form.Control type="date"
          value={taskForm.due_date}
          onChange={e=>setTaskForm(f=>({...f,due_date:e.target.value}))}
        />
      </Form.Group>
      <Form.Group className="mb-2">
        <Form.Label>Priorité</Form.Label>
        <Form.Select
          value={taskForm.priority}
          onChange={e=>setTaskForm(f=>({...f,priority:e.target.value}))}
        >
          <option value="haute">Haute</option>
          <option value="moyenne">Moyenne</option>
          <option value="basse">Basse</option>
        </Form.Select>
      </Form.Group>
      <Form.Group className="mb-2">
        <Form.Label>Assignés</Form.Label>
        <Select
          isMulti
          options={users.map(u=>({value:u.id,label:`${u.name} ${u.prenom}`}))}
          value={users.filter(u=>taskForm.assigned_to.includes(u.id))}
          onChange={opts=>setTaskForm(f=>({...f,assigned_to:opts.map(o=>o.value)}))}
        />
      </Form.Group>
    </Form>
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={()=>setShowTaskModal(false)}>
      Annuler
    </Button>
    <Button variant="primary" onClick={handleSaveTask}>
      {editingTask?'Enregistrer':'Créer'}
    </Button>
  </Modal.Footer>
</Modal>

    </>
  );
}
