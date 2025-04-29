import React, { useEffect, useState } from 'react'; 
import Navbar from './Navbar';
import { Container, Row, Col, Spinner, Card } from 'react-bootstrap';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

const Statistique = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/stats')
      .then((res) => {
        setStats(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erreur lors de la récupération des statistiques :', err);
        setLoading(false);
      });
  }, []);

  const dataBar = [
    { name: 'Utilisateurs', value: stats?.totalUsers },
    { name: 'Documents', value: stats?.totalDocuments },
    { name: 'Tâches', value: stats?.totalTasks },
    { name: 'Workflows', value: stats?.totalWorkflows },
    { name: 'Notifications', value: stats?.totalNotifications }
  ];

  const dataPie = [
    { name: 'Utilisateurs', value: stats?.totalUsers, fill: '#8884d8' },
    { name: 'Documents', value: stats?.totalDocuments, fill: '#82ca9d' },
    { name: 'Tâches', value: stats?.totalTasks, fill: '#ffc658' },
    { name: 'Workflows', value: stats?.totalWorkflows, fill: '#ff8042' },
    { name: 'Notifications', value: stats?.totalNotifications, fill: '#ffb6c1' }
  ];

  return (
    <>
      <Navbar />
      <Container className="mt-4">

        {loading ? (
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <p>Chargement des statistiques...</p>
          </div>
        ) : (
          stats && (
            <Row className="g-4">
              {/* Graphique en Barres */}
              <Col md={6}>
                <Card className="shadow-sm">
                  <Card.Body>
                    <Card.Title>Statistiques par Catégorie</Card.Title>
                    <BarChart width={500} height={300} data={dataBar}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </Card.Body>
                </Card>
              </Col>

              {/* Graphique en Camembert */}
              <Col md={6}>
                <Card className="shadow-sm">
                  <Card.Body>
                    <Card.Title>Répartition des Statistiques</Card.Title>
                    <PieChart width={400} height={400}>
                      <Pie
                        data={dataPie}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={150}
                        fill="#8884d8"
                        label
                      >
                        {dataPie.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )
        )}
      </Container>
    </>
  );
};

export default Statistique;
