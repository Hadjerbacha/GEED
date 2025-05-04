// Fichier : WorkflowPage.js (version Master Pro améliorée)
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Button, Badge, Spinner, Modal, Form, Card, Row, Col, ProgressBar, Tooltip, OverlayTrigger } from 'react-bootstrap';
import Select from 'react-select';
import { motion, AnimatePresence } from 'framer-motion';
import ReactFlow, { MiniMap, Controls, Background } from 'reactflow';
import 'reactflow/dist/style.css';
import { FiClock, FiUsers, FiAlertCircle, FiCheckCircle, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import Navbar from './Navbar';
import Chatbot from './chatbot';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiEdit, FiTrash2 } from 'react-icons/fi';

// Configuration des couleurs
const statusColors = {
  completed: 'success',
  pending: 'warning',
  in_progress: 'primary',
  failed: 'danger'
};

const priorityColors = {
  haute: 'danger',
  moyenne: 'warning',
  basse: 'info'
};

// Composant de carte de tâche personnalisée
const TaskCard = ({ task, onComplete }) => {
  const dueDate = task.due_date ? parseISO(task.due_date) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'completed';

  return (
    <motion.div 
      whileHover={{ y: -2, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`mb-3 ${isOverdue ? 'border-danger' : ''}`}>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="d-flex align-items-center mb-2">
                <Badge bg={statusColors[task.status] || 'secondary'} className="me-2">
                  {task.status === 'completed' ? <FiCheckCircle className="me-1" /> : <FiClock className="me-1" />}
                  {task.status}
                </Badge>
                <Badge bg={priorityColors[task.priority] || 'secondary'}>{task.priority}</Badge>
              </div>
              <h5 className="mb-1">{task.name}</h5>
              <p className="text-muted mb-2">{task.description}</p>
              
              <div className="d-flex align-items-center text-muted small">
                {dueDate && (
                  <>
                    <FiClock className="me-1" />
                    <span className="me-3">
                      {format(dueDate, 'PPp', { locale: fr })}
                    </span>
                  </>
                )}
                {task.assigned_to?.length > 0 && (
                  <>
                    <FiUsers className="me-1" />
                    <span>{task.assigned_to.join(', ')}</span>
                  </>
                )}
              </div>
            </div>
            <div className="d-flex justify-content-end mt-2">
  <Button 
    variant="outline-primary" 
    size="sm" 
    onClick={() => onComplete(task)}
    disabled={task.status === 'completed'}
  >
    {task.status === 'completed' ? 'Terminée' : 'Marquer terminée'}
  </Button>

  <Button 
    variant="outline-secondary" 
    size="sm" 
    className="ms-2"
  >
    <FiEdit /> Modifier
  </Button>

  <Button 
    variant="outline-danger" 
    size="sm" 
    className="ms-2"
  >
    <FiTrash2 /> Supprimer
  </Button>
</div>

          </div>
        </Card.Body>
      </Card>
    </motion.div>
  );
};

// Composant de statistiques
const StatsPanel = ({ workflow, steps }) => {
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const completionPercentage = steps.length ? Math.round((completedSteps / steps.length) * 100) : 0;

  return (
    <Card className="mb-4">
      <Card.Body>
        <Row>
          <Col md={4} className="border-end">
            <div className="text-center">
              <h6 className="text-muted">Statut</h6>
              <Badge bg={statusColors[workflow.status]} className="fs-6 p-2">
                {workflow.status}
              </Badge>
            </div>
          </Col>
          <Col md={4} className="border-end">
            <div className="text-center">
              <h6 className="text-muted">Progression</h6>
              <ProgressBar 
                now={completionPercentage} 
                label={`${completionPercentage}%`} 
                variant={completionPercentage === 100 ? 'success' : 'primary'}
                className="mt-1"
                style={{ height: '24px' }}
              />
            </div>
          </Col>
          <Col md={4}>
            <div className="text-center">
              <h6 className="text-muted">Tâches</h6>
              <h4>
                {completedSteps} <small className="text-muted">/ {steps.length}</small>
              </h4>
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export default function WorkflowPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const document = location.state?.document;
  const token = localStorage.getItem('token');

  const [workflow, setWorkflow] = useState(null);
  const [steps, setSteps] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({ 
    title: '', 
    description: '', 
    due_date: '', 
    priority: 'moyenne', 
    assigned_to: [] 
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wfRes, logRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/workflows/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`http://localhost:5000/api/workflows/${id}/logs`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setWorkflow(wfRes.data.workflow);
      setSteps(wfRes.data.steps);
      setLogs(logRes.data);
    } catch (err) {
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    axios.get('http://localhost:5000/api/auth/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setUsers(res.data.map(u => ({ value: u.id, label: u.name }))))
      .catch(() => toast.error("Impossible de charger les utilisateurs"));
  }, [token]);

  useEffect(() => {
    if (!steps.length) return;
    
    const n = steps.map((s, i) => ({
      id: String(s.id),
      type: i === 0 ? 'input' : i === steps.length - 1 ? 'output' : 'default',
      position: { x: 100 + i * 250, y: 100 + (i % 2) * 150 },
      data: { 
        label: (
          <div className="text-center p-2">
            <div className="fw-bold">{s.name}</div>
            <Badge bg={statusColors[s.status]} className="mt-1">
              {s.status}
            </Badge>
          </div>
        )
      },
      style: {
        border: `2px solid var(--bs-${statusColors[s.status] || 'secondary'})`,
        borderRadius: '8px',
        padding: '10px'
      }
    }));
    
    const e = steps.slice(1).map((s, i) => ({
      id: `e${steps[i].id}-${s.id}`,
      source: String(steps[i].id),
      target: String(s.id),
      animated: s.status === 'in_progress',
      style: {
        stroke: `var(--bs-${statusColors[s.status] || 'secondary'})`,
        strokeWidth: 2
      }
    }));
    
    setNodes(n);
    setEdges(e);
  }, [steps]);

  const completeStep = async (step) => {
    try {
      await axios.post(
        `http://localhost:5000/api/workflows/${id}/steps/${step.id}/complete`, 
        {}, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Étape "${step.name}" complétée`);
      fetchAll();
    } catch {
      toast.error('Erreur lors de la complétion');
    }
  };

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskForm({ 
      title: '', 
      description: '', 
      due_date: '', 
      priority: 'moyenne', 
      assigned_to: [] 
    });
    setShowTaskModal(true);
  };

  const handleSaveTask = async () => {
    try {
      const payload = { 
        ...taskForm, 
        workflow_id: id, 
        assigned_to: taskForm.assigned_to.map(u => u.value) 
      };
      
      if (editingTask) {
        await axios.put(
          `http://localhost:5000/api/tasks/${editingTask.id}`, 
          payload, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Tâche mise à jour');
      } else {
        await axios.post(
          'http://localhost:5000/api/tasks', 
          payload, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Tâche créée');
      }
      setShowTaskModal(false);
      fetchAll();
    } catch {
      toast.error("Erreur lors de la sauvegarde de la tâche");
    }
  };

  const generateTasks = async () => {
    try {
      const prompt = `Voici le nom d'un workflow : ${workflow.name} et sa description : ${workflow.description}.\nGénère une liste de tâches au format JSON, chaque tâche doit avoir les champs suivants : title, description et due_date.`;
      await axios.post(
        `http://localhost:5000/api/workflows/${id}/generate-tasks`, 
        { prompt }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Tâches générées avec succès');
      fetchAll();
    } catch {
      toast.error("Erreur lors de la génération des tâches");
    }
  };

  const analyzeLogsWithAI = async () => {
    try {
      setIsAnalyzing(true);
      const logsText = logs.map(log => log.message).join('\n');
      
      // Vérification que l'ID est bien défini
      if (!id) {
        throw new Error("ID du workflow non disponible");
      }
  
      const response = await axios.post(
        `http://localhost:5000/api/workflows/${id}/analyze-logs`, 
        { 
          prompt: logsText,
          workflowInfo: {  // Ajoutez ces informations si votre backend les utilise
            name: workflow?.name || "",
            description: workflow?.description || ""
          }
        },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
  
      toast.info(
        <div>
          <h6>Analyse IA des logs</h6>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {response.data.analysis}
          </pre>
        </div>,
        { autoClose: 10000 }
      );
  
    } catch (error) {
      console.error("Détails de l'erreur:", error);
      toast.error(
        error.response?.data?.message || 
        error.message || 
        "Erreur lors de l'analyse IA",
        { autoClose: 5000 }
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <Chatbot />
      
      <div className="container-fluid py-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* En-tête */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h1 className="fw-bold mb-1">{workflow.name}</h1>
              <p className="text-muted mb-0">{workflow.description}</p>
            </div>
            <div className="d-flex gap-2">
              <OverlayTrigger placement="bottom" overlay={<Tooltip>Actualiser les données</Tooltip>}>
                <Button variant="outline-secondary" onClick={fetchAll}>
                  <FiRefreshCw />
                </Button>
              </OverlayTrigger>
              <Button variant="primary" onClick={analyzeLogsWithAI} disabled={isAnalyzing}>
                {isAnalyzing ? 'Analyse en cours...' : 'Analyser avec IA'}
              </Button>
            </div>

          </div>

          {/* Panneau de statistiques */}
          <StatsPanel workflow={workflow} steps={steps} />

          {/* Diagramme de workflow */}
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Visualisation du workflow</h5>
              <Button 
                variant="outline-primary" 
                size="sm" 
                onClick={() => setShowDiagram(!showDiagram)}
              >
                {showDiagram ? 'Masquer' : 'Afficher'}
              </Button>
            </Card.Header>
            <AnimatePresence>
              {showDiagram && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card.Body className="p-0" style={{ height: '400px' }}>
                    <ReactFlow 
                      nodes={nodes} 
                      edges={edges} 
                      fitView
                      nodesDraggable={false}
                    >
                      <MiniMap nodeStrokeWidth={3} />
                      <Controls />
                      <Background color="#aaa" gap={16} />
                    </ReactFlow>
                  </Card.Body>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* Liste des tâches */}
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Tâches du workflow</h5>
              <div className="d-flex gap-2">
                <OverlayTrigger placement="top" overlay={<Tooltip>Générer automatiquement des tâches</Tooltip>}>
                  <Button variant="outline-secondary" size="sm" onClick={generateTasks}>
                    <FiPlus className="me-1" /> Générer
                  </Button>
                </OverlayTrigger>
                <Button variant="success" size="sm" onClick={openCreateTask}>
                  <FiPlus className="me-1" /> Nouvelle tâche
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {steps.length === 0 ? (
                <div className="text-center py-4">
                  <FiAlertCircle size={48} className="text-muted mb-3" />
                  <h5>Aucune tâche disponible</h5>
                  <p className="text-muted">Commencez par créer une nouvelle tâche</p>
                  <Button variant="primary" onClick={openCreateTask}>
                    Créer une tâche
                  </Button>
                </div>
              ) : (
                <motion.div layout>
                  {steps.map(step => (
                    <TaskCard key={step.id} task={step} onComplete={completeStep} />
                  ))}
                </motion.div>
              )}
            </Card.Body>
          </Card>
        </motion.div>
      </div>

      {/* Modal de création/édition de tâche */}
      <Modal show={showTaskModal} onHide={() => setShowTaskModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Titre</Form.Label>
              <Form.Control 
                type="text" 
                value={taskForm.title}
                onChange={(e) => setTaskForm({...taskForm, title: e.target.value})}
                placeholder="Nom de la tâche"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={3}
                value={taskForm.description}
                onChange={(e) => setTaskForm({...taskForm, description: e.target.value})}
                placeholder="Description détaillée"
              />
            </Form.Group>
            
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Date d'échéance</Form.Label>
                  <Form.Control 
                    type="date" 
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({...taskForm, due_date: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Priorité</Form.Label>
                  <Form.Select 
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})}
                  >
                    <option value="haute">Haute</option>
                    <option value="moyenne">Moyenne</option>
                    <option value="basse">Basse</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Label>Assigner à</Form.Label>
              <Select
                isMulti
                options={users}
                value={taskForm.assigned_to}
                onChange={(selected) => setTaskForm({...taskForm, assigned_to: selected})}
                placeholder="Sélectionner des utilisateurs..."
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowTaskModal(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSaveTask}>
            {editingTask ? 'Enregistrer' : 'Créer'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}