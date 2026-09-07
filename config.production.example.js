// Copie este contenido a config.js al publicar junto con la API PHP.
// La ruta relativa mantiene frontend y API bajo el mismo dominio.
window.OLEOLAB_CONFIG = Object.freeze({
  API_URL: 'api/index.php',
  DEMO_MODE: false,
  REQUEST_TIMEOUT_MS: 30000,
  APP_VERSION: '0.3.2'
});
