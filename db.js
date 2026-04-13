const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// PERSISTENCIA BLINDADA: Ajustamos la ruta para que sea absoluta y segura en Hostinger
const DATA_DIR = process.env.DATA_PATH || path.resolve(__dirname, 'encuesta_central_data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ENCUESTAS_FILE = path.join(DATA_DIR, 'encuestas.json');
const SCHEMA_FILE = path.join(DATA_DIR, 'schema.json');

// Crear carpeta de datos si no existe
if (!fs.existsSync(DATA_DIR)) {
    console.log(`[DB] Creando carpeta de datos persistente en: ${DATA_DIR}`);
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
function loadSchema() {
    if (!fs.existsSync(SCHEMA_FILE)) return null; // null = usar el default del cliente
    return JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));
}

function saveSchema(schema) {
    fs.writeFileSync(SCHEMA_FILE, JSON.stringify(schema, null, 2));
}

// ─── USERS ────────────────────────────────────────────────────────────────────
function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ─── ENCUESTAS ────────────────────────────────────────────────────────────────
function loadEncuestas() {
    if (!fs.existsSync(ENCUESTAS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ENCUESTAS_FILE, 'utf8'));
}

function saveEncuestas(encuestas) {
    fs.writeFileSync(ENCUESTAS_FILE, JSON.stringify(encuestas, null, 2));
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
            const lat = datos.q2 && datos.q2.lat ? Number(datos.q2.lat).toFixed(6) : "0";
            const lng = datos.q2 && datos.q2.lng ? Number(datos.q2.lng).toFixed(6) : "0";
            const { q2, timestamp, ...respuestas } = datos;
            // Usamos un separador simple en lugar de JSON.stringify para ganar microsegundos
            return `${lat}|${lng}|${Object.values(respuestas).join('|')}`;
        } catch (e) {
            return JSON.stringify(datos);
        }
    },

    findDuplicate: (datos) => {
        const encuestas = loadEncuestas();
        const newFingerprint = module.exports.getSurveyFingerprint(datos);
        
        return encuestas.find(e => {
            const existingFingerprint = module.exports.getSurveyFingerprint(e.datos);
            return existingFingerprint === newFingerprint;
        });
    },

    // Encuestas
    getAllEncuestas: () => loadEncuestas(),
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

    // Schema
    getSchema: () => loadSchema(),
    saveSchema: (schema) => saveSchema(schema),

    init
};
