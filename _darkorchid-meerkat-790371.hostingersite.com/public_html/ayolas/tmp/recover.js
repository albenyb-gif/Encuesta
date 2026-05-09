const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = 'c:\\gemini\\ENCUESTA\\copia de hostinger\\nodejs\\encuesta.db';

if (!fs.existsSync(dbPath)) {
    console.error('No se encontró el archivo encuesta.db');
    process.exit(1);
}

try {
    const db = new Database(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tablas encontradas:', tables);

    for (const table of tables) {
        const rows = db.prepare(`SELECT * FROM ${table.name}`).all();
        console.log(`Tabla ${table.name}: ${rows.length} registros`);
        fs.writeFileSync(`/tmp/dump_${table.name}.json`, JSON.stringify(rows, null, 2));
    }
} catch (e) {
    console.error('Error al leer la base de datos:', e.message);
}
