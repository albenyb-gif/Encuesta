# 🚀 Guía de Despliegue en Hostinger - Encuesta Senior Pro 2.0

He reorganizado el proyecto para que sea **seguro y profesional**. Ahora los archivos están divididos entre la lógica del servidor y la interfaz pública.

## 1. Archivos que DEBES subir
Para que la aplicación funcione en Hostinger, sube únicamente estos archivos y carpetas a tu directorio (`public_html` o una subcarpeta):

- 📂 `public/` (Contiene index.html, app.js, style.css, etc.)
- 📂 `encuesta_central_data/` (Tu base de datos JSON actual)
- 📄 `server.js` (El corazón de la app)
- 📄 `db.js` (La gestión de datos)
- 📄 `package.json` (Las dependencias)
- 📄 `.htaccess` (Configuración de servidor)

> [!IMPORTANT]
> **NO SUBAS** la carpeta `node_modules/`. Hostinger la generará automáticamente al instalar las dependencias.
> **NO ES NECESARIO** subir los scripts de Python (`.py`) ni archivos `.csv` sueltos a producción, a menos que los uses allí.

## 2. Configuración en Hostinger (Node.js Selector)

1. **Versión de Node.js**: Selecciona **Node.js 18.x** o superior.
2. **App Root**: La carpeta donde subiste los archivos (ej: `public_html/encuesta`).
3. **App Mode**: `production`.
4. **App Startup File**: `server.js`.
5. **Run NPM Install**: Haz clic en este botón después de subir los archivos para instalar `express`, `bcryptjs` y `jsonwebtoken`.

## 3. Variables de Entorno (Opcional)
En el panel de Hostinger puedes añadir:
- `PORT`: Generalmente Hostinger lo asigna solo, pero puedes poner `3000`.
- `JWT_SECRET`: Una clave larga y aleatoria para firmar los tokens de seguridad.

## 4. Mejoras de Seguridad Aplicadas
- **Aislamiento**: Ahora nadie puede descargar tus archivos `.json` o tus scripts `.js` del servidor entrando por la URL, ya que solo la carpeta `public` es accesible al navegador.
- **Persistencia**: La carpeta `encuesta_central_data` está protegida fuera del alcance público.

---
¡Tu aplicación está lista para el mundo! Si tienes algún error al subirla, revisa los "Logs" en el panel de Hostinger.
