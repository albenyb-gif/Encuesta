const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

// Inicializar base de datos
db.init();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'encuesta_senior_pro_secret_2024';

app.use(express.json());
app.use(express.static(__dirname));

// ─── Middleware de Autenticación ─────────────────────────────────────────────
function authMiddleware(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

function adminOnly(req, res, next) {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo el administrador puede hacer esto' });
    next();
}

// ─── API Login ────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
    const { nombre, password } = req.body;
    const usuario = db.findUserByName(nombre);
    if (!usuario || !bcrypt.compareSync(password, usuario.password_hash)) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    const token = jwt.sign(
        { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
        JWT_SECRET,
        { expiresIn: '12h' }
    );
    res.json({ token, nombre: usuario.nombre, rol: usuario.rol });
});

// ─── API Encuestas ────────────────────────────────────────────────────────────
app.post('/api/encuestas', authMiddleware, (req, res) => {
    const { datos } = req.body;
    if (!datos) return res.status(400).json({ error: 'Datos requeridos' });
    const enc = db.createEncuesta(req.user.id, req.user.nombre, datos);
    res.json({ id: enc.id, mensaje: 'Encuesta guardada correctamente' });
});

app.get('/api/encuestas', authMiddleware, (req, res) => {
    const encuestas = req.user.rol === 'admin'
        ? db.getAllEncuestas()
        : db.getEncuestasByUser(req.user.id);
    res.json(encuestas);
});

app.delete('/api/encuestas/:id', authMiddleware, (req, res) => {
    const enc = db.deleteEncuesta(req.params.id);
    if (!enc) return res.status(404).json({ error: 'No encontrada' });
    if (req.user.rol !== 'admin' && enc.usuario_id !== req.user.id) {
        return res.status(403).json({ error: 'Sin permiso' });
    }
    res.json({ mensaje: 'Eliminada' });
});

// ─── API Usuarios (Admin) ─────────────────────────────────────────────────────
app.get('/api/usuarios', authMiddleware, adminOnly, (req, res) => {
    res.json(db.getAllUsers());
});

app.post('/api/usuarios', authMiddleware, adminOnly, (req, res) => {
    const { nombre, password, rol } = req.body;
    if (!nombre || !password) return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
    try {
        db.createUser(nombre, password, rol || 'encuestador');
        res.json({ mensaje: `Usuario ${nombre} creado` });
    } catch (e) {
        res.status(409).json({ error: e.message });
    }
});

app.put('/api/usuarios/:id', authMiddleware, adminOnly, (req, res) => {
    try {
        db.updateUser(req.params.id, req.body);
        res.json({ mensaje: 'Usuario actualizado' });
    } catch (e) {
        res.status(404).json({ error: e.message });
    }
});

app.delete('/api/usuarios/:id', authMiddleware, adminOnly, (req, res) => {
    const usuario = db.findUserById(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'No encontrado' });
    if (usuario.rol === 'admin') return res.status(403).json({ error: 'No se puede eliminar al admin' });
    db.deleteUser(req.params.id);
    res.json({ mensaje: 'Usuario eliminado' });
});

// ─── Fallback SPA ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Encuesta Senior Pro corriendo en puerto ${PORT}`);
});
