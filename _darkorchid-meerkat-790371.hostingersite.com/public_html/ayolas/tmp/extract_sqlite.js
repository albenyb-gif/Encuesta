const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'copia de seguridad', 'nodejs', 'encuesta.db');
const db = new sqlite3.Database(dbPath);

console.log(`Leyendo base de datos: ${dbPath}`);

db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, tables) => {
    if (err) {
        console.error("Error al listar tablas:", err);
        return;
    }
    console.log("Tablas encontradas:", tables);
    
    // Asumimos que la tabla se llama 'encuestas'
    db.all("SELECT COUNT(*) as count FROM encuestas", (err, rows) => {
        if (err) {
            console.error("Error al contar encuestas:", err);
            return;
        }
        console.log(`Total de encuestas en SQLite: ${rows[0].count}`);
        
        db.all("SELECT * FROM encuestas", (err, allRows) => {
            if (err) {
                console.error("Error al leer encuestas:", err);
                return;
            }
            console.log(JSON.stringify(allRows, null, 2));
            db.close();
        });
    });
});
