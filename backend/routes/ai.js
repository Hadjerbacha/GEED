const express = require('express');
const axios = require('axios');
const router = express.Router();

// Appelle le serveur local Python
router.post('/suggest_description', async (req, res) => {
  const { title } = req.body;

  if (!title || title.trim() === "") {
    return res.status(400).json({ error: "Le titre est requis." });
  }

  try {
    const response = await axios.post('http://localhost:8000/suggest_description', { title });
    res.json({ description: response.data.description });
  } catch (err) {
    console.error("Erreur serveur IA local :", err.message);
    res.status(500).json({ error: "Erreur de génération IA locale." });
  }
});

module.exports = router;
