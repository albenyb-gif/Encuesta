const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, 'TEMPLATE_NUEVO_PROYECTO', 'encuesta_central_data');

const adminUser = {
    id: 1,
    nombre: 'admin',
    password_hash: bcrypt.hashSync('admin2024', 10),
    rol: 'admin'
};

fs.writeFileSync(path.join(TEMPLATE_DIR, 'users.json'), JSON.stringify([adminUser], null, 2));

console.log('Carpeta de datos limpia creada exitosamente en TEMPLATE_NUEVO_PROYECTO');
