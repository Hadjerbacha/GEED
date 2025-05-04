const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/', async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Texte requis pour le résumé.' });
  }

  const MAX_TEXT_LENGTH = 2000; // Limite de caractères
  let cleanedText = text.trim(); // Supprimer les espaces au début et à la fin

  // Nettoyer les caractères de contrôle (comme \r, \n, \t, etc.)
  cleanedText = cleanedText.replace(/[\x00-\x1F\x7F-\x9F]/g, ''); // Enlève les caractères non imprimables

  // Remplacer les retours à la ligne par des espaces pour uniformiser le texte
  cleanedText = cleanedText.replace(/(\r\n|\n|\r)/gm, ' ').replace(/[\t\n\r\f\v]/g, ' ');

  // Limiter la longueur du texte pour éviter de dépasser les limites
  const truncatedText = cleanedText.length > MAX_TEXT_LENGTH ? cleanedText.slice(0, MAX_TEXT_LENGTH) : cleanedText;

  try {
    // Requête API avec texte propre et limité
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=${process.env.GOOGLE_API_KEY}`,
      {
        prompt: `Résumé ce texte : ${truncatedText}`, // Texte nettoyé
        temperature: 0.7,
        maxOutputTokens: 150, // Nombre maximum de tokens à générer
        topP: 0.9, // Paramètre d'échantillonnage
        topK: 40, // Paramètre d'échantillonnage
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const summary = response.data?.candidates?.[0]?.content; // Récupération du résumé
    res.json({ summary });
  } catch (error) {
    console.error('Erreur API:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erreur avec l\'API Google', details: error.response?.data });
  }
});

module.exports = router;
