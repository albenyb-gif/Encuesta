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

// ─── SSE: Clientes conectados ─────────────────────────────────────────────────
const sseClients = new Map(); // Map<userId, res>

function broadcastSchemaUpdate(schema) {
    const payload = JSON.stringify({ type: 'schema-updated', schema });
    sseClients.forEach((res, userId) => {
        try {
            res.write(`data: ${payload}\n\n`);
        } catch (e) {
            sseClients.delete(userId);
        }
    });
    console.log(`[SSE] Schema broadcast a ${sseClients.size} clientes conectados.`);
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
        { expiresIn: '7d' }
    );
    res.json({ token, nombre: usuario.nombre, rol: usuario.rol });
});

// ─── API Schema (Compartido en servidor) ─────────────────────────────────────
// GET: Cualquier usuario autenticado puede obtener el esquema actual
app.get('/api/schema', authMiddleware, (req, res) => {
    const schema = db.getSchema();
    res.json({ schema }); // null si no hay schema guardado en servidor
});

// PUT: Solo admin puede actualizar el esquema → broadcast en tiempo real
app.put('/api/schema', authMiddleware, adminOnly, (req, res) => {
    const { schema } = req.body;
    if (!schema || !Array.isArray(schema)) return res.status(400).json({ error: 'Schema inválido' });
    db.saveSchema(schema);
    broadcastSchemaUpdate(schema);
    res.json({ mensaje: 'Schema actualizado y enviado a todos los encuestadores' });
});

// ─── SSE: Canal de eventos en tiempo real ─────────────────────────────────────
// EventSource no permite headers → token va en query string
app.get('/api/events', (req, res) => {
    const token = req.query.token || req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).end();
    let user;
    try {
        user = jwt.verify(token, JWT_SECRET);
    } catch {
        return res.status(401).end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const userId = `${user.id}_${Date.now()}`;
    sseClients.set(userId, res);
    console.log(`[SSE] Conectado: ${user.nombre} (total: ${sseClients.size})`);

    const heartbeat = setInterval(() => {
        try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        sseClients.delete(userId);
        console.log(`[SSE] Desconectado: ${user.nombre} (total: ${sseClients.size})`);
    });
});

// ─── API Encuestas ────────────────────────────────────────────────────────────
app.post('/api/encuestas', authMiddleware, (req, res) => {
    const { datos, timestamp } = req.body;
    if (!datos) return res.status(400).json({ error: 'Datos requeridos' });

    // ESCUDO ANTI-DUPLICADOS: Si ya existe una igual, no guardamos otra
    const duplicate = db.findDuplicate(datos);
    if (duplicate) {
        console.log(`[DUPLICADO] Intento de duplicar encuesta ignorado (${req.user.nombre})`);
        return res.json({ id: duplicate.id, mensaje: 'Encuesta ya registrada previamente', duplicada: true });
    }

    const enc = db.createEncuesta(req.user.id, req.user.nombre, datos, timestamp);
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

// ─── IMPORTACIÓN DE EMERGENCIA ────────────────────────────────────────────────
app.post('/api/admin/import-data', authMiddleware, adminOnly, (req, res) => {
    const { encuestas } = req.body;
    if (!Array.isArray(encuestas)) return res.status(400).json({ error: 'Se requiere un array de encuestas' });
    
    const current = db.getAllEncuestas();
    let imported = 0;
    
    encuestas.forEach(newEnc => {
        // Evitar duplicados basados en timestamp y usuario
        const exists = current.some(e => 
            e.timestamp === newEnc.timestamp && 
            e.usuario_id === newEnc.usuario_id
        );
        
        if (!exists) {
            db.createEncuesta(
                newEnc.usuario_id || 0, 
                newEnc.usuario_nombre || 'Importado', 
                newEnc.datos || newEnc, 
                newEnc.timestamp
            );
            imported++;
        }
    });
    
    res.json({ mensaje: `Importación completada. Se añadieron ${imported} registros nuevos.` });
});

// Endpoint para limpiar duplicados (MANTENIMIENTO ULTRA-RÁPIDO)
app.post('/api/admin/clean-duplicates', authMiddleware, adminOnly, (req, res) => {
    try {
        console.log("[LIMPIEZA] Iniciando proceso de saneamiento...");
        const current = db.getAllEncuestas();
        const seen = new Set();
        const unique = [];

        // Procesamiento en memoria pura (O(n))
        for (const e of current) {
            const fingerprint = db.getSurveyFingerprint(e.datos);
            if (!seen.has(fingerprint)) {
                seen.add(fingerprint);
                unique.push(e);
            }
        }

        const removedCount = current.length - unique.length;
        
        // Escritura única al final
        db.saveEncuestas(unique);

        console.log(`[LIMPIEZA] Finalizada. Eliminados: ${removedCount}, Quedaron: ${unique.length}`);
        
        // Devolvemos JSON puro siempre
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(JSON.stringify({ 
            mensaje: `Limpieza profunda completada.`, 
            quedaron: unique.length,
            eliminados: removedCount 
        }));
    } catch (e) {
        console.error("Error en limpieza:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Encuesta Senior Pro corriendo en puerto ${PORT}`);
});
