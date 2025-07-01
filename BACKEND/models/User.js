
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  telephone: String,
  ville: String,
  adresse: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  role: { type: String, default: 'user' }
});

module.exports = mongoose.model('User', userSchema);
