// DocumentList.js
import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button} from "react-bootstrap";
import { motion } from "framer-motion";

const documents = [
  { id: 1, title: "Contrat Fournisseur.pdf" },
  { id: 2, title: "PV de réunion - Avril.docx" },
];

export default function DocumentList() {
  const navigate = useNavigate();

  const handleStartWorkflow = (docId) => {
    navigate(`/test`);
  };

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
      {documents.map((doc) => (
        <motion.div
          key={doc.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          
<Card className="rounded-2xl shadow-xl">
  <Card.Body>
    <Card.Title><h2 className="text-xl font-semibold mb-2">{doc.title}</h2></Card.Title>
    <Card.Text><Button onClick={() => handleStartWorkflow(doc.id)}>
                🚀 Démarrer Workflow
              </Button></Card.Text>
  </Card.Body>
</Card>
        </motion.div>
      ))}
    </div>
  );
}