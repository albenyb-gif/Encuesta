const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'encuesta.db'));

// Crear tablas si no existen
db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'encuestador'
    );

    CREATE TABLE IF NOT EXISTS encuestas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        usuario_nombre TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        datos TEXT NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
`);

// Crear usuarios por defecto si la tabla está vacía
const count = db.prepare('SELECT COUNT(*) as c FROM usuarios').get();
if (count.c === 0) {
    const usuarios = [
        { nombre: 'admin',    password: 'admin2024',    rol: 'admin' },
        { nombre: 'Miguel',   password: 'miguel123',    rol: 'encuestador' },
        { nombre: 'Santiago', password: 'santiago123',  rol: 'encuestador' },
        { nombre: 'Mirna',    password: 'mirna123',     rol: 'encuestador' },
        { nombre: 'Milena',   password: 'milena123',    rol: 'encuestador' },
        { nombre: 'Mabel',    password: 'mabel123',     rol: 'encuestador' },
    ];
    const insert = db.prepare('INSERT INTO usuarios (nombre, password_hash, rol) VALUES (?, ?, ?)');
    for (const u of usuarios) {
        insert.run(u.nombre, bcrypt.hashSync(u.password, 10), u.rol);
    }
    console.log('Usuarios iniciales creados.');
}

module.exports = db;
