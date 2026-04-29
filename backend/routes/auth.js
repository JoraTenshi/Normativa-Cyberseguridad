const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const { JWT_SECRET, JWT_EXPIRES } = require('../middleware/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, nombre: user.nombre },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function safeUser(u) {
  return { id: u._id, nombre: u.nombre, email: u.email, createdAt: u.createdAt };
}

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (typeof nombre !== 'string' || nombre.trim() === '') {
      return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' });
    }
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: 'Email inválido' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const exists = await Usuario.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ ok: false, error: 'El email ya está registrado' });
    }

    const usuario = await Usuario.create({ nombre: nombre.trim(), email, password });
    res.status(201).json({ ok: true, data: { token: signToken(usuario), usuario: safeUser(usuario) } });

  } catch (err) {
    console.error('Error en registro:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno al registrar el usuario' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ ok: false, error: 'Email y contraseña son obligatorios' });
    }

    const usuario = await Usuario.findOne({ email: email.toLowerCase().trim() });
    // Same error for wrong email or wrong password — avoids user enumeration
    if (!usuario || !(await usuario.verificarPassword(password))) {
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
    }

    res.json({ ok: true, data: { token: signToken(usuario), usuario: safeUser(usuario) } });

  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno al iniciar sesión' });
  }
});

module.exports = router;
