// src/components/OverdueAlert.js
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';

const Alerts = ({ tasks }) => {
  const [overdueTasks, setOverdueTasks] = useState([]);

  useEffect(() => {
    const now = new Date();
    const overdue = tasks.filter(task => {
      const dueDate = new Date(task.due_date);
      return dueDate < now && task.status !== 'completed';
    });
    setOverdueTasks(overdue);
  }, [tasks]);

  if (overdueTasks.length === 0) return null;

  return (
    <>
      {overdueTasks.length > 0 && (
        <Alert variant="danger">
          <strong>⚠️ Tâches en retard :</strong>{' '}
          {overdueTasks.map(t => t.title).join(', ')}
        </Alert>
      )}
    </>
  );
};

export default Alerts;
