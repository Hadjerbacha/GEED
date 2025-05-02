const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getUsers, findUserByEmail, createUser, updateUser, deleteUser } = require("../models/userModel");
require("dotenv").config();


// Fonction pour récupérer tous les utilisateurs
// Exemple de contrôleur pour récupérer des utilisateurs
const getUsersController = async (req, res) => {
  try {
    const users = await getUsers(); // Suppose que tu appelles une fonction pour obtenir les utilisateurs
    res.json(users); // Renvoie les utilisateurs en JSON
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server Error' }); // Si erreur, renvoie une réponse d'erreur
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await findUserByEmail(email);
    if (!user)
      return res.status(400).json({ message: "Email ou mot de passe invalide" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(400).json({ message: "Email ou mot de passe invalide" });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "300d",
    });

    const { password: _, ...userData } = user;
    res.status(200).json({ token, user: userData });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};


const register = async (req, res) => {
  const { name, prenom, email, password, role = "employe" } = req.body;
  console.log("Reçu :", req.body);
  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "Cet email est déjà utilisé." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await createUser({
      name,
      prenom,
      email,
      password: hashedPassword,
      role,
    });

    res.status(201).json({ message: "Inscription réussie", user: newUser });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Mettre à jour un utilisateur
const updateUserController = async (req, res) => {
  const { id } = req.params;
  const { name, prenom, email, role } = req.body;

  try {
    const updated = await updateUser(id, { name, prenom, email, role });
    res.status(200).json({ message: "Utilisateur mis à jour", user: updated });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Supprimer un utilisateur
const deleteUserController = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await deleteUser(id);
    if (!deleted) return res.status(404).json({ message: "Utilisateur introuvable" });
    res.status(200).json({ message: "Utilisateur supprimé", user: deleted });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = {
  getUsersController,
  login,
  register,
  updateUserController,
  deleteUserController
};
