const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
// 👇 Add this right after your imports
router.get('/', (req, res) => {
  res.send('🟢 User route up');
});

// ➕ Route pour l'inscription
router.post('/register', async (req, res) => {
  try {
    const { nom, prenom, email, password, telephone, ville, adresse } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email déjà utilisé." });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      nom, prenom, email,
      password: hashedPassword,
      telephone, ville, adresse
    });

    await newUser.save();
     res.status(201).json({ message: "Utilisateur enregistré avec succès." });
  } catch (error) {
  console.error("Erreur lors de l'inscription :", error);
  res.status(500).json({ message: "Erreur serveur", error: error.message });
}
});

module.exports = router;

// 🔐 Route de login utilisateur
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Email ou mot de passe incorrect." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Email ou mot de passe incorrect." });

    // Exclure le mot de passe avant d'envoyer
    const { password: _, ...userWithoutPassword } = user.toObject();

    res.status(200).json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Erreur login :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

