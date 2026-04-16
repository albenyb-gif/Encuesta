const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// PERSISTENCIA BLINDADA: Volvemos a la ruta relativa probada en Hostinger
const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, '..', 'encuesta_central_data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ENCUESTAS_FILE = path.join(DATA_DIR, 'encuestas.json');
const SCHEMA_FILE = path.join(DATA_DIR, 'schema.json');

// Crear carpeta de datos si no existe
if (!fs.existsSync(DATA_DIR)) {
    console.log(`[DB] Creando carpeta de datos persistente en: ${DATA_DIR}`);
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ESCRITURA ATÓMICA: Evita corrupción si el proceso se corta a mitad de escritura
function safeWriteJson(filePath, data) {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, filePath);
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
function loadSchema() {
    if (!fs.existsSync(SCHEMA_FILE)) return null; // null = usar el default del cliente
    return JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));
}

function saveSchema(schema) {
    safeWriteJson(SCHEMA_FILE, schema);
}

// ─── USERS ────────────────────────────────────────────────────────────────────
function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
    safeWriteJson(USERS_FILE, users);
}

// ─── ENCUESTAS ────────────────────────────────────────────────────────────────
function loadEncuestas() {
    if (!fs.existsSync(ENCUESTAS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ENCUESTAS_FILE, 'utf8'));
}

function saveEncuestas(encuestas) {
    safeWriteJson(ENCUESTAS_FILE, encuestas);
}

// ─── INIT: Crear usuarios por defecto ─────────────────────────────────────────
function init() {
    const users = loadUsers();
    if (users.length === 0) {
        const initialUsers = [
            { nombre: 'admin',    password: 'admin2024',   rol: 'admin' },
            { nombre: 'Miguel',   password: 'miguel123',   rol: 'encuestador' },
            { nombre: 'Santiago', password: 'santiago123', rol: 'encuestador' },
            { nombre: 'Mirna',    password: 'mirna123',    rol: 'encuestador' },
            { nombre: 'Milena',   password: 'milena123',   rol: 'encuestador' },
            { nombre: 'Mabel',    password: 'mabel123',    rol: 'encuestador' },
        ];
        let nextId = 1;
        const hashedUsers = initialUsers.map(u => ({
            id: nextId++,
            nombre: u.nombre,
            password_hash: bcrypt.hashSync(u.password, 10),
            rol: u.rol
        }));
        saveUsers(hashedUsers);
        console.log('Usuarios iniciales creados.');
    }
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
module.exports = {
    // Users
    findUserByName: (nombre) => loadUsers().find(u => u.nombre === nombre),
    findUserById: (id) => loadUsers().find(u => u.id === Number(id)),
    getAllUsers: () => loadUsers().map(({ password_hash, ...u }) => u),
    createUser: (nombre, password, rol) => {
        const users = loadUsers();
        if (users.find(u => u.nombre === nombre)) throw new Error('Ya existe ese usuario');
        const newId = users.length ? Math.max(...users.map(u => u.id)) + 1 : 1;
        const newUser = { id: newId, nombre, password_hash: bcrypt.hashSync(password, 10), rol };
        users.push(newUser);
        saveUsers(users);
        return newUser;
    },
    updateUser: (id, { nombre, password, rol }) => {
        const users = loadUsers();
        const idx = users.findIndex(u => u.id === Number(id));
        if (idx === -1) throw new Error('Usuario no encontrado');
        if (nombre) users[idx].nombre = nombre;
        if (rol) users[idx].rol = rol;
        if (password) users[idx].password_hash = bcrypt.hashSync(password, 10);
        saveUsers(users);
    },
    deleteUser: (id) => {
        let users = loadUsers();
        users = users.filter(u => u.id !== Number(id));
        saveUsers(users);
    },

    // Huella digital para detectar duplicados (Optimizado para Velocidad)
    getSurveyFingerprint: (datos) => {
        if (!datos) return "";
        try {
            // Normalizar coordenadas a 6 decimales para la huella
            const lat = (datos.q2 && datos.q2.lat) ? Number(datos.q2.lat).toFixed(6) : "0";
            const lng = (datos.q2 && datos.q2.lng) ? Number(datos.q2.lng).toFixed(6) : "0";
            
            // Extraer solo las respuestas relevantes para la huella (evitar timestamp si viene en datos)
            const { q2, timestamp, ...respuestas } = datos;
            
            // Ordenar llaves para consistencia en el fingerprint
            const sortedValues = Object.keys(respuestas).sort().map(key => respuestas[key]);
            
            return `${lat}|${lng}|${sortedValues.join('|')}`;
        } catch (e) {
            return JSON.stringify(datos);
        }
    },

    findDuplicate: (datos) => {
        const encuestas = loadEncuestas();
        
        // Normalizar coordenadas y timestamp para la comparación
        const lat = (datos.q2 && datos.q2.lat) ? Number(datos.q2.lat).toFixed(6) : null;
        const lng = (datos.q2 && datos.q2.lng) ? Number(datos.q2.lng).toFixed(6) : null;
        const timestamp = datos.timestamp;

        return encuestas.find(e => {
            const eLat = (e.datos.q2 && e.datos.q2.lat) ? Number(e.datos.q2.lat).toFixed(6) : null;
            const eLng = (e.datos.q2 && e.datos.q2.lng) ? Number(e.datos.q2.lng).toFixed(6) : null;
            
            // ESCUDO NIVEL 1: Coordenadas + Timestamp (Detecta re-envíos exactos del mismo celular)
            if (lat && lng && eLat && eLng && lat === eLat && lng === eLng) {
                if (timestamp && e.timestamp === timestamp) return true;
                
                // ESCUDO NIVEL 2: Mismas coordenadas + Mismo Barrio (q3) o Demográficos (q_demo)
                // Esto protege si el timestamp cambió levemente pero son los mismos datos en el mismo punto
                if (datos.q3 === e.datos.q3 && datos.q_demo === e.datos.q_demo) return true;
            }
            
            // ESCUDO NIVEL 3: Huella digital completa (fallback heredado)
            const existingFingerprint = module.exports.getSurveyFingerprint(e.datos);
            const newFingerprint = module.exports.getSurveyFingerprint(datos);
            return existingFingerprint === newFingerprint;
        });
    },

    // Encuestas
    getAllEncuestas: () => loadEncuestas(),
    saveEncuestas: (encuestas) => saveEncuestas(encuestas),
    getEncuestasByUser: (usuario_id) => loadEncuestas().filter(e => e.usuario_id === Number(usuario_id)),
    createEncuesta: (usuario_id, usuario_nombre, datos, timestamp = null) => {
        const encuestas = loadEncuestas();
        const newId = encuestas.length ? Math.max(...encuestas.map(e => e.id)) + 1 : 1;
        const newEnc = { 
            id: newId, 
            usuario_id, 
            usuario_nombre, 
            timestamp: timestamp || new Date().toISOString(), 
            datos 
        };
        encuestas.push(newEnc);
        saveEncuestas(encuestas);
        return newEnc;
    },
    deleteEncuesta: (id) => {
        const encuestas = loadEncuestas();
        const enc = encuestas.find(e => e.id === Number(id));
        if (!enc) return null;
        saveEncuestas(encuestas.filter(e => e.id !== Number(id)));
        return enc;
    },

    deleteEncuestasBulk: (ids) => {
        if (!Array.isArray(ids)) return 0;
        const numericIds = ids.map(id => Number(id));
        const encuestas = loadEncuestas();
        const initialCount = encuestas.length;
        const filtered = encuestas.filter(e => !numericIds.includes(e.id));
        saveEncuestas(filtered);
        return initialCount - filtered.length;
    },

    // Schema
    getSchema: () => loadSchema(),
    saveSchema: (schema) => saveSchema(schema),

    init
};
