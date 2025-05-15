from fastapi import FastAPI, HTTPException
from transformers import pipeline
import asyncio
from pydantic import BaseModel
import logging
from fastapi.middleware.cors import CORSMiddleware

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NLP Classification Service")

# Autoriser les requêtes CORS (à adapter selon vos besoins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

# Modèle de requête
class ClassificationRequest(BaseModel):
    text: str
    categories: list[str] | None = None

# Chargement du modèle au démarrage
@app.on_event("startup")
async def load_model():
    global classifier
    try:
        logger.info("Chargement du modèle NLP...")
        classifier = pipeline(
            "zero-shot-classification",
            model="facebook/bart-large-mnli",
            device="cpu"  # Changez à "cuda" si vous avez un GPU
        )
        logger.info("Modèle chargé avec succès")
    except Exception as e:
        logger.error(f"Erreur de chargement du modèle: {str(e)}")
        raise

@app.post("/classify")
async def classify_document(request: ClassificationRequest):
    try:
        # Catégories par défaut si non spécifiées
        categories = request.categories or [
            "contrat", "rapport", "mémoire", 
            "présentation", "note interne", 
            "facture", "cv", "photo"
        ]
        
        # Classification
        result = classifier(
            request.text, 
            candidate_labels=categories,
            multi_label=False
        )
        
        return {
            "category": result["labels"][0],
            "confidence": float(result["scores"][0]),
            "all_predictions": dict(zip(result["labels"], result["scores"]))
        }
        
    except Exception as e:
        logger.error(f"Erreur de classification: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur de traitement NLP: {str(e)}"
        )

# Route de santé
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host="0.0.0.0",  # Écoute sur toutes les interfaces
        port=5001,
        log_level="info",
        timeout_keep_alive=30
    )