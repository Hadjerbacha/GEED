// controllers/taskController.js
const nodemailer = require('nodemailer');
const User = require('../models/UserMoel'); // modèle des utilisateurs


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'votre.email@gmail.com',
    pass: 'votre_mot_de_passe_app'
  }
});

const sendNotification = async (assignedUserIds, task, creatorName) => {
  const users = await User.findAll({ where: { id: assignedUserIds } });

  for (const user of users) {
    await transporter.sendMail({
      from: '"GED System" <votre.email@gmail.com>',
      to: user.email,
      subject: `Nouvelle tâche assignée : ${task.title}`,
      html: `
        <p>Bonjour ${user.name},</p>
        <p><strong>${creatorName}</strong> vous a assigné une tâche.</p>
        <p><strong>Titre :</strong> ${task.title}</p>
        <p><strong>Description :</strong> ${task.description}</p>
        <p><strong>Échéance :</strong> ${task.due_date}</p>
        <p>Veuillez vous connecter au système GED pour plus de détails.</p>
      `
    });
  }
};
