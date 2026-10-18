# Contribuir a Syka Recorder

Conservá el motor y la interfaz aprobados. Captura, editor y transferencia son recorridos distintos: indicá qué verificaste.

Con Node 22+ y npm, ejecutá npm ci y npm run dev. Los auxiliares nativos de Windows requieren Visual Studio Build Tools y Windows SDK. No copies node_modules ni herramientas locales de otra computadora.

Antes de proponer cambios:

- Ejecutar TypeScript y pruebas pertinentes; incluir regresiones para errores de captura, importación, audio y rutas.
- Verificar cambios visuales en la app real y conservar marca, proporciones y reduced motion.
- Probar transferencias moviendo la carpeta completa, sin fuentes originales.
- Excluir perfiles, grabaciones, tokens, .env, .tmp y resultados QA.
- Respetar licencias y mantener Recorder y Studio en repositorios separados.
- No publicar ni habilitar actualizaciones como parte de una compilación local.

El PR debe explicar problema, resultado, pruebas y límites. Una compilación no certifica el instalador en otra PC.

[Guía histórica de upstream](docs/upstream/CONTRIBUTING-Recordly.md).
