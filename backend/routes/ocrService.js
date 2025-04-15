const Tesseract = require('tesseract.js');
const path = require('path');

async function extractTextFromImage(filePath) {
  try {
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng'); // 'fra' aussi possible
    return text;
  } catch (err) {
    console.error('Erreur OCR :', err);
    return '';
  }
}

module.exports = { extractTextFromImage };
