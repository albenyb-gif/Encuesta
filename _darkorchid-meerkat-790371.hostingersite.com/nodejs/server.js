const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

// Inicializar base de datos
db.init();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'encuesta_senior_pro_secret_v3';

app.use(express.json());

// SEGURIDAD: Solo servimos archivos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// ─── SSE: Clientes conectados ─────────────────────────────────────────────────
const sseClients = new Map();

function broadcastSchemaUpdate(schema) {
    const payload = JSON.stringify({ type: 'schema-updated', schema });
    sseClients.forEach((res, userId) => {
        try {
            res.write(`data: ${payload}\n\n`);
        } catch (e) {
            sseClients.delete(userId);
        }
    });
}

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
        { expiresIn: '30d' }
    );
    res.json({ token, nombre: usuario.nombre, rol: usuario.rol });
});

// ─── API Schema ─────────────────────────────────────────────────────────────
app.get('/api/schema', authMiddleware, (req, res) => {
    res.json({ schema: db.getSchema() });
});

app.put('/api/schema', authMiddleware, adminOnly, (req, res) => {
    const { schema } = req.body;
    if (!schema || !Array.isArray(schema)) return res.status(400).json({ error: 'Schema inválido' });
    db.saveSchema(schema);
    broadcastSchemaUpdate(schema);
    res.json({ mensaje: 'Estructura 3.0 actualizada correctamente' });
});

// ─── SSE: Canal de eventos ─────────────────────────────────────────────────────
app.get('/api/events', (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(401).end();
    let user;
    try { user = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).end(); }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const userId = `${user.id}_${Date.now()}`;
    sseClients.set(userId, res);

    const heartbeat = setInterval(() => {
        try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        sseClients.delete(userId);
    });
});

// ─── API Encuestas ────────────────────────────────────────────────────────────
app.post('/api/encuestas', authMiddleware, (req, res) => {
    const { datos, timestamp } = req.body;
    if (!datos) return res.status(400).json({ error: 'Datos requeridos' });

    const duplicate = db.findDuplicate(datos);
    if (duplicate) return res.json({ id: duplicate.id, mensaje: 'Ya registrada', duplicada: true });

    const enc = db.createEncuesta(req.user.id, req.user.nombre, datos, timestamp);
    res.json({ id: enc.id, mensaje: 'Encuesta 3.0 guardada' });
});

app.get('/api/encuestas', authMiddleware, (req, res) => {
    const rol = req.user.rol ? req.user.rol.toLowerCase() : '';
    const encuestas = (rol === 'admin' || rol === 'analista')
        ? db.getAllEncuestas()
        : db.getEncuestasByUser(req.user.id);
    res.json(encuestas);
});

app.delete('/api/encuestas/:id', authMiddleware, adminOnly, (req, res) => {
    db.deleteEncuesta(req.params.id);
    res.json({ mensaje: 'Eliminada' });
});

app.delete('/api/admin/encuestas/bulk', authMiddleware, adminOnly, (req, res) => {
    const { ids } = req.body;
    const count = db.deleteEncuestasBulk(ids);
    res.json({ mensaje: `Eliminadas ${count} encuestas.` });
});

// ─── API Usuarios ─────────────────────────────────────────────────────────────
app.get('/api/usuarios', authMiddleware, adminOnly, (req, res) => {
    res.json(db.getAllUsers());
});

app.post('/api/usuarios', authMiddleware, adminOnly, (req, res) => {
    const { nombre, password, rol } = req.body;
    db.createUser(nombre, password, rol || 'encuestador');
    res.json({ mensaje: `Usuario ${nombre} creado` });
});

app.delete('/api/usuarios/:id', authMiddleware, adminOnly, (req, res) => {
    db.deleteUser(req.params.id);
    res.json({ mensaje: 'Usuario eliminado' });
});

// ─── Mantenimiento ────────────────────────────────────────────────────────────
app.post('/api/admin/clean-duplicates', authMiddleware, adminOnly, (req, res) => {
    const current = db.getAllEncuestas();
    const seen = new Set();
    const unique = [];

    for (const e of current) {
        const fingerprint = db.getSurveyFingerprint(e.datos);
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        unique.push(e);
    }

    db.saveEncuestas(unique);
    res.json({ mensaje: 'Limpieza completada', eliminados: current.length - unique.length });
});

// Redirección SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Encuesta Senior Pro 3.0 activa en puerto ${PORT}`);
});
