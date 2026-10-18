# Publicar actualizaciones de Syka Recorder

Destino único: `SikJa/syka-recorder`. Recorder conserva `appId: dev.syka.recorder`, el nombre de ejecutable y su perfil entre versiones. Studio mantiene su propio actualizador y perfil.

## Nueva versión

1. Incrementar `version` en `package.json` y `package-lock.json`.
2. Ejecutar TypeScript, tests, `npm run audit:publication` y la prueba de transferencia a la versión actual de Studio.
3. Crear el commit y el tag `vX.Y.Z` que corresponda al código probado. Subirlos al repositorio de Syka.
4. `Syka Recorder Windows release` compila el instalador y los metadatos, verifica los binarios y crea una **release borrador** con todos sus archivos.
5. Probar el instalador. Añadir notas, demo y capturas si cambiaron; publicar el borrador cuando esté listo.

Una release estable publicada se ofrece en Recorder. Un tag, un commit o un borrador no generan una actualización por sí solos. No editar ni reemplazar binarios de una versión publicada: aumentar la versión.

## Archivos de la release

- `Syka-Recorder-x64-Setup.exe`
- `Syka-Recorder-x64-Setup.exe.blockmap`
- `latest.yml`
- `SHA256SUMS.txt`
- Demo opcional `Syka-Recorder-demo.mp4`
- Código fuente del tag, disponible en los archivos que GitHub genera para cada release.

El instalador y `latest.yml` deben salir de la misma compilación. Electron Builder incluye `resources/app-update.yml` con el repo de Syka; no depende de `origin`, que en un checkout de desarrollo puede seguir apuntando a Recordly.

## Comportamiento del actualizador

Consulta a los 15 segundos de iniciar y cada 6 horas. Descarga sólo cuando el usuario lo elige; instalar al cerrar está desactivado. Antes de reiniciar comprueba que no haya captura activa ni cambios sin guardar. Las preferencias experimentales heredadas no cambian el canal estable.

Para probar avisos sin instalar: las vistas de desarrollo del actualizador son simulaciones. Una prueba completa necesita dos versiones empaquetadas, un feed controlado o releases reales, descarga íntegra y reinicio con el perfil conservado. No presentar una simulación como actualización real.

## Compatibilidad con Studio

La instalación en ejecución se detecta primero; después, rutas estándar y versiones de Squirrel, ordenadas numéricamente. Las instalaciones personalizadas pueden elegirse. No se copian sesiones ni credenciales.

Antes de cada publicación: guardar/abrir un proyecto, ejecutar `syka check main` y capturar una vista de la composición. Comprobar fondo, marcos, cámara y audio. Un cambio incompatible de CLI/formato en Studio puede requerir adaptar Recorder; no se promete compatibilidad con versiones futuras desconocidas.

## Plataformas y firma

Primera distribución: Windows x64, instalador sin firma Authenticode. Las pruebas locales no certifican una PC limpia. Los workflows heredados de publicación Recordly/Homebrew/WinGet quedan restringidos al repo original. No publican productos de Syka en canales ajenos.

Referencia: [electron-builder 26, auto-update](https://www.electron.build/v26/docs/features/auto-update/).
