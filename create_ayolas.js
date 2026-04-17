const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'encuesta_central_data (1)');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function loadUsers() {
    try {
        const content = fs.readFileSync(USERS_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function createAyolas() {
    const users = loadUsers();
    const nombre = 'Ayolas';
    const password = 'Ayolas123';
    const rol = 'analista';

    if (users.find(u => u.nombre === nombre)) {
        console.log(`El usuario '${nombre}' ya existe.`);
        return;
    }

    const newId = users.length ? Math.max(...users.map(u => u.id)) + 1 : 1;
    const newUser = {
        id: newId,
        nombre,
        password_hash: bcrypt.hashSync(password, 10),
        rol
    };

    users.push(newUser);
    saveUsers(users);
    console.log(`Usuario '${nombre}' creado con éxito con rol '${rol}'.`);
}

createAyolas();
