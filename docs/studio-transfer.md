# Transferencia y portabilidad

## Detección en Windows

Orden: instalación en ejecución → ubicaciones estándar → ubicación personalizada recordada → aviso de instalación.

Se buscan `SykaStudio`, `Syka Studio` y `syka-studio` en LocalAppData, Program Files y sus carpetas Programs. Se reconocen carpetas Squirrel `app-<versión>`; se prueba primero la versión más reciente con ejecutable y CLI. Una instalación personalizada cerrada se puede elegir manualmente. No se recorre todo el disco.

Se utiliza `resources/cli/dapi.js` de Studio con argumentos separados, sin concatenar comandos de shell. La confirmación verifica la carpeta solicitada. Una instalación estándar usa su perfil habitual y no hereda variables de perfil/servidor de Recorder o QA.

Instalaciones personalizadas pueden declarar rutas literales en `Abrir Syka Studio.ps1`, junto a la app o en la carpeta padre. Se leen sólo rutas conocidas; el script no se ejecuta. Si falta el disco configurado, se informa en vez de crear un perfil vacío.

Sin Studio, una ventana explica que el proyecto está guardado y ofrece **Descargar Syka Studio**, **Buscar instalación** y **Ahora no**. Descargar abre la página oficial de releases; no ejecuta instaladores. Después se puede reintentar **Abrir en Syka Studio** sin exportar de nuevo.

## Carpeta portable

`index.tsx`, `assets.yml` y `manifest.json` referencian `media/` con rutas relativas. Incluye pantalla, cámara, audio, fondo y máscaras. Copiar toda la carpeta. Los snapshots bajo `recordly/` conservan el documento histórico y sus rutas; Studio no depende de ellas.

Una versión de Studio sin CLI requiere actualizarse. macOS/Linux conservan apertura manual; la detección automática se implementó para Windows.

## Audio

Micrófono y sistema van separados. No se agrega además la mezcla embebida cuando hay pistas separadas. Pantalla, webcam y fondo están silenciados para evitar duplicaciones. Se convierten ganancias a dB y se respeta mute.

La transferencia limita la ganancia al nivel audible en la vista previa de Recorder: normalizar no añade en Studio una amplificación que esa vista previa no podía reproducir. Se retiró el aumento fijo de 40% del micrófono en la captura combinada del navegador. Esto no repara saturación ya grabada ni modifica archivos existentes.

## Prueba antes de distribuir

1. Sin Studio: comprobar aviso, cancelar, descargar y buscar instalación.
2. Con Studio cerrado y abierto: abrir paquete en el perfil habitual.
3. Mover carpeta a una ruta con espacios y acentos; abrir sin fuentes originales.
4. Comparar fondo animado, máscara, sombras, cortes, velocidad, mute y audio.

Los tests usan instalaciones simuladas y medios temporales. No sustituyen una instalación en un segundo equipo.
