const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

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

// ─── API de Autenticación ────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
    const { nombre, password } = req.body;
    const usuario = db.prepare('SELECT * FROM usuarios WHERE nombre = ?').get(nombre);
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

// ─── API de Encuestas ────────────────────────────────────────────────────────
// Guardar nueva encuesta
app.post('/api/encuestas', authMiddleware, (req, res) => {
    const { datos } = req.body;
    if (!datos) return res.status(400).json({ error: 'Datos de encuesta requeridos' });
    const stmt = db.prepare('INSERT INTO encuestas (usuario_id, usuario_nombre, timestamp, datos) VALUES (?, ?, ?, ?)');
    const result = stmt.run(req.user.id, req.user.nombre, new Date().toISOString(), JSON.stringify(datos));
    res.json({ id: result.lastInsertRowid, mensaje: 'Encuesta guardada correctamente' });
});

// Obtener encuestas (admin ve todas, encuestador solo las suyas)
app.get('/api/encuestas', authMiddleware, (req, res) => {
    let encuestas;
    if (req.user.rol === 'admin') {
        encuestas = db.prepare('SELECT * FROM encuestas ORDER BY timestamp DESC').all();
    } else {
        encuestas = db.prepare('SELECT * FROM encuestas WHERE usuario_id = ? ORDER BY timestamp DESC').all(req.user.id);
    }
    // Parsear datos JSON
    encuestas = encuestas.map(e => ({ ...e, datos: JSON.parse(e.datos) }));
    res.json(encuestas);
});

// Eliminar encuesta (admin siempre, encuestador solo la suya)
app.delete('/api/encuestas/:id', authMiddleware, (req, res) => {
    const encuesta = db.prepare('SELECT * FROM encuestas WHERE id = ?').get(req.params.id);
    if (!encuesta) return res.status(404).json({ error: 'Encuesta no encontrada' });
    if (req.user.rol !== 'admin' && encuesta.usuario_id !== req.user.id) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar esta encuesta' });
    }
    db.prepare('DELETE FROM encuestas WHERE id = ?').run(req.params.id);
    res.json({ mensaje: 'Encuesta eliminada' });
});

// ─── API de Usuarios (Solo Admin) ────────────────────────────────────────────
// Obtener todos los usuarios
app.get('/api/usuarios', authMiddleware, adminOnly, (req, res) => {
    const usuarios = db.prepare('SELECT id, nombre, rol FROM usuarios ORDER BY nombre').all();
    res.json(usuarios);
});

// Crear nuevo usuario
app.post('/api/usuarios', authMiddleware, adminOnly, (req, res) => {
    const { nombre, password, rol } = req.body;
    if (!nombre || !password) return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
    try {
        db.prepare('INSERT INTO usuarios (nombre, password_hash, rol) VALUES (?, ?, ?)').run(nombre, bcrypt.hashSync(password, 10), rol || 'encuestador');
        res.json({ mensaje: `Usuario ${nombre} creado correctamente` });
    } catch {
        res.status(409).json({ error: 'Ese nombre de usuario ya existe' });
    }
});

// Editar usuario (nombre, contraseña, rol)
app.put('/api/usuarios/:id', authMiddleware, adminOnly, (req, res) => {
    const { nombre, password, rol } = req.body;
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const nuevoNombre = nombre || usuario.nombre;
    const nuevoRol = rol || usuario.rol;
    const nuevoHash = password ? bcrypt.hashSync(password, 10) : usuario.password_hash;
    
    db.prepare('UPDATE usuarios SET nombre = ?, password_hash = ?, rol = ? WHERE id = ?').run(nuevoNombre, nuevoHash, nuevoRol, req.params.id);
    res.json({ mensaje: 'Usuario actualizado correctamente' });
});

// Eliminar usuario
app.delete('/api/usuarios/:id', authMiddleware, adminOnly, (req, res) => {
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (usuario.rol === 'admin') return res.status(403).json({ error: 'No se puede eliminar al administrador' });
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(req.params.id);
    res.json({ mensaje: 'Usuario eliminado' });
});

// ─── Fallback SPA ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Encuesta Senior Pro corriendo en puerto ${PORT}`);
});
