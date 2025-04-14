const express = require("express");
const router = express.Router();
const { getUsersController, login, register } = require("../controllers/authController");

// Route pour récupérer tous les utilisateurs
router.get("/users", getUsersController); 
router.post("/login", login);
router.post("/register", register);


module.exports = router;


