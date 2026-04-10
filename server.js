const express = require('express');
const path = require('path');
const app = express();

// Servir archivos estáticos desde la carpeta raíz
app.use(express.static(__dirname));

// Todas las rutas cargan index.html (Soporte para PWA/Single Page App)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Hostinger asignará un puerto automáticamente en process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Encuesta ejecutándose en el puerto ${PORT}`);
});
