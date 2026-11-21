<p align="center">
  <img src="public/app-icons/syka-recorder-512.png" width="116" height="116" alt="Syka Recorder: cinta orbital negra con centro bordó" />
</p>
<h1 align="center">Syka Recorder</h1>
<p align="center"><b>Grabá tu pantalla. Explicá tu idea. Seguí en Syka Studio.</b></p>
<p align="center">
  <a href="https://github.com/SikJa/syka-recorder/releases/latest/download/Syka-Recorder-x64-Setup.exe"><img src="docs/media/download-es.svg" width="400" height="87" alt="Descargar ahora · Windows x64" /></a>
</p>
<p align="center">
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/c%C3%B3digo-AGPL--3.0-467b65" alt="Código abierto AGPL-3.0" /></a>
  <img src="https://img.shields.io/badge/Windows-x64-0078D4" alt="Windows x64" />
  <a href="https://github.com/webadderallorg/Recordly"><img src="https://img.shields.io/badge/basado_en-Recordly-555" alt="Basado en Recordly" /></a>
</p>
<p align="center"><b>Español</b> · <a href="README.en.md">English</a> · <a href="#instalación">Instalación</a> · <a href="#de-recorder-a-studio">Editar en Studio</a> · <a href="CREDITS.md">Créditos</a></p>

**Syka Recorder es un fork independiente de [Recordly](https://github.com/webadderallorg/Recordly), creado por webadderall y sus colaboradores.** Sobre su grabadora y editor, Syka agrega su identidad visual, anotaciones durante la grabación y un puente a proyectos editables de [Syka Studio](https://github.com/SikJa/syka-studio). Conservamos el código abierto, el historial y las atribuciones del proyecto original.

<p align="center"><img src="docs/media/recorder-editor.png" width="100%" alt="Editor real de Syka Recorder con fondo, marco y cámara de ejemplo" /></p>
<p align="center"><sub>Captura de la aplicación. El contenido y la cámara son material de demostración.</sub></p>

## De una toma a un proyecto

| Grabá | Explicá | Editá |
| --- | --- | --- |
| Pantalla, ventana o región; webcam, micrófono y audio del sistema. | Lápiz, línea, flecha, formas, resaltador, texto y difuminado. | Cortes, velocidad, zooms, cursor, fondos, bordes y sombras. |
| Barra flotante que podés minimizar y mover. | Un panel que se cierra sin desactivar el dibujo. Deshacer con Ctrl+Z. | Vista en pantalla completa y exportación MP4 o proyecto de Studio. |

Sin cuenta de Recordly. Grabaciones y proyectos locales. Podés usar Recorder solo; Studio es opcional para continuar la edición.

## De Recorder a Studio

1. Terminá la grabación y ajustá el fondo, el encuadre y la cámara en Recorder.
2. Tocá **Editar en Syka → Guardar y abrir en Studio**.
3. Elegí una carpeta. Recorder guarda el proyecto y lo abre en tu instalación de Studio.
4. Seguí editando: los medios, cortes, fondo, marcos, sombras, cámara y pistas de audio conservan su estructura editable. La cámara llega como un video común: la movés, la achicás y le cambiás bordes y sombra en Studio.

La carpeta del proyecto se ordena así:

- `01 Grabación`: pantalla, cámara, fondo y audio, listos para editar.
- `02 Finales`: el video terminado (si dejás activado *Incluir el video terminado*) y lo que exportes desde Studio.
- `03 Originales sin editar`: la captura tal como salió.
- `99 Archivos técnicos (no tocar)`: lo que Studio y Recorder necesitan por dentro.

<p align="center"><img src="docs/media/transfer-dialog.png" width="760" alt="Opciones para guardar el proyecto y abrirlo en Syka Studio" /></p>
<p align="center"><img src="docs/media/studio-project.png" width="100%" alt="La misma composición abierta en Syka Studio" /></p>

<p align="center"><a href="https://github.com/SikJa/syka-recorder/releases/latest/download/Syka-Recorder-demo.mp4"><img src="docs/media/demo-preview.gif" width="768" alt="Demo real: fondo MacOS Style en Recorder y el mismo proyecto editado en Studio" /></a></p>

**[Ver la demo completa · 37 segundos](https://github.com/SikJa/syka-recorder/releases/latest/download/Syka-Recorder-demo.mp4)** · [Qué se probó](docs/demo.md) · [Cómo funciona la transferencia](docs/studio-transfer.md)

Si no tenés Studio, aparece un aviso para **descargarlo**, **buscar una instalación existente** o **seguir después**. El proyecto ya queda guardado. Si Studio ya está abierto, el proyecto se abre ahí. Si no, Recorder usa la instalación más nueva entre la que elegiste antes y las carpetas habituales.

Compartí **la carpeta completa**, no sólo `manifest.json`. Los medios del proyecto nativo usan rutas relativas. No se copian cuentas ni perfiles. La compatibilidad se comprueba contra la versión de Studio disponible: cambios futuros de su formato o CLI pueden necesitar una actualización de Recorder.

## Vertical y vista de app

- **Encuadre vertical:** en 9:16, *Seguir el cursor* llena el cuadro con tu pantalla y la cámara acompaña al cursor, con tus zooms encima. *Ajustar* muestra la pantalla entera, como antes.
- **Vista de app:** en la barra de la vista previa, *Vista de app* dibuja la interfaz de TikTok, Instagram Reels, Stories, YouTube Shorts o YouTube encima del video, para ver qué tapan los botones y la descripción. También muestra solo las zonas seguras. No se exporta. Las zonas seguras salen de las guías de cada plataforma; la posición de cada botón es una estimación de las apps al 21/11/2026 ([investigación](docs/platform-overlays-research.md)).

## Para agentes (MCP)

Recorder trae un servidor MCP local para que un agente lo maneje: ver el estado, elegir qué pantalla o ventana grabar, listar y abrir proyectos, grabar (iniciar, pausar, reanudar, reiniciar, detener), exportar MP4 y pasar un proyecto a Studio. Solo escucha en tu equipo y rechaza pedidos que vengan de páginas web. Se apaga en **Configuración → General**, donde también está la dirección.

```bash
claude mcp add --transport http syka-recorder http://127.0.0.1:4171/mcp
```

## Instalación

**Windows x64.** Descargá el instalador con el botón de arriba, ejecutalo y abrí Syka Recorder. No necesitás Node.js ni herramientas de desarrollo. El instalador actual no tiene firma Authenticode; Windows puede mostrar un aviso de editor desconocido. Los hashes están en la release.

El código conserva soporte heredado de otras plataformas, pero esta distribución y la integración con Studio se validan en Windows. No ofrecemos todavía instaladores certificados de macOS/Linux.

### Actualizaciones

Recorder consulta las releases estables de **este repositorio** al iniciar y periódicamente. Cuando hay una versión nueva, muestra un aviso. Vos elegís descargarla y reiniciar; no instala al cerrar ni interrumpe una grabación o un proyecto sin guardar. Publicar sólo código no actualiza la aplicación: cada release necesita el instalador, su `.blockmap` y `latest.yml` generados juntos.

## Algunas cosas que conviene saber

- Los dibujos quedan incorporados al video. Ctrl+Z quita la marca desde ese momento; no borra cuadros ya grabados.
- Los atajos de dibujo necesitan foco en Recorder. El difuminado trabaja con una muestra estática.
- Cursor y dibujos grabados son parte del video transferido. En Studio la cámara se achica con el zoom igual que en Recorder; sus esquinas usan arcos de círculo, muy parecidos a la forma de Recorder.
- La versión inicial se probó localmente. Una compilación exitosa no reemplaza las pruebas en distintos equipos, cámaras y dispositivos de audio.

## Desarrollo y contribuciones

Node.js 22+, npm, Visual Studio Build Tools y Windows SDK para compilar los auxiliares de captura.

```sh
npm ci
npm run dev
```

```sh
npm run typecheck
npm test
npm run build:win -- --publish never
```

El instalador queda en `release/`. [Contribuir](CONTRIBUTING.md) · [Publicar una actualización](docs/releases.md) · [Reportar un problema](https://github.com/SikJa/syka-recorder/issues)

## Código abierto, origen y créditos

El trabajo de **Recordly, webadderall y sus colaboradores** es la base de esta aplicación. No lo presentamos como un motor desarrollado desde cero. Las herramientas de dibujo están adaptadas de **[Whispera](https://github.com/SikJa/Whispera)**, bajo MIT. **Syka Studio** conserva su repositorio y licencia independientes; las adaptaciones de archivos MPL mantienen sus avisos. El orbe usa **thinking-orbs**, los iconos son de **Phosphor**, la tipografía es **Inter** y el procesamiento de medios utiliza **FFmpeg/ffprobe**.

El código cubierto y nuestras modificaciones se publican bajo **[AGPL-3.0](LICENSE.md)**. Los componentes de terceros conservan sus propias licencias. Cada release enlaza su código fuente y el instalador incluye los avisos.

**[Créditos completos](CREDITS.md)** · **[Avisos de terceros](THIRD_PARTY_NOTICES.md)** · [Documentación original de Recordly](docs/upstream/README-Recordly.md)

Syka Recorder es un proyecto independiente: los créditos no implican afiliación ni aval de los autores originales.
