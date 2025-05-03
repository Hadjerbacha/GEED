require("dotenv").config();
const pool = require("./config/db");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const tasksRoutes = require("./routes/workflow");
const docsRoutes = require("./routes/documents");
const chatRoutes =require("./routes/chatbot");
const collectionRoutes =require("./routes/collection");
const groupRoutes = require('./routes/groupe');
const listTasksRoutes = require('./routes/listTasks');
const workflowsRoutes = require("./routes/task");
const notifRoutes = require("./routes/notif");
const workRoutes = require("./routes/work");
const aiRoutes = require("./routes/ai");
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const corsOptions = {
    origin: "http://localhost:3000",  // Ton frontend React
  };
  app.use(cors(corsOptions));
  
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true }));
app.use('/api', statsRoutes);


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/documents", docsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/collection",collectionRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/list-tasks', listTasksRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/workflow', workRoutes);
app.use('/api/', aiRoutes);
// Lancement du serveur
app.listen(PORT, () => console.log(`🚀 Serveur lancé sur le port ${PORT}`));

pool.connect()
  .then(() => console.log("✅ Connexion à la base de données réussie"))
  .catch((err) => console.error("❌ Erreur de connexion à la base de données :", err));