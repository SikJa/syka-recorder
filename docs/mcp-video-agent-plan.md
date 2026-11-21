# Plan: que un agente haga videos con Syka Recorder y Syka Studio

Objetivo: decirle a un agente "hacé un video de X" y que grabe la pantalla real
(Syka Code, una web, cualquier app), mueva el mouse y escriba como una persona,
edite en Recorder (zooms, cortes, encuadre, cámara) y entregue un proyecto
editable en Studio, con el mismo look que si lo hubieras grabado vos.

## Lo que ya existe (1.4.4–1.4.5)

`status`, `list_sources`, `select_source`, `start/stop/pause/resume/restart_recording`,
`list_projects`, `open_project`, `export_mp4` (incluye 2×), `transfer_to_studio`
(paquete ordenado con video terminado). En Studio, su propio MCP: `open`,
`check`, `capture`, `export`, `gate`.

## Lo que falta, por etapas

### Etapa 1 — Editar en Recorder desde el agente (bajo riesgo, mucho valor)

| Herramienta | Qué hace |
| --- | --- |
| `get_timeline` | Clips, zooms, velocidades, cortes, anotaciones, duración, clics del cursor con su tiempo. |
| `preview_frames` | Devuelve imágenes de la vista previa en tiempos dados: el agente **mira** lo que va a exportar. |
| `add_zoom` / `update_zoom` / `remove_zoom` | Zoom en un tramo, manual (foco x,y) o siguiendo el cursor; profundidad 1.25×–3×. |
| `auto_zooms` | Propone zooms en los clics y tipeos (usa la telemetría del cursor). |
| `cut` / `trim` / `speed_up` | Cortar tramos, recortar puntas, acelerar tiempos muertos. |
| `remove_idle` | Detecta silencios y pantalla quieta y los acelera o corta. |
| `set_scene` | Fondo, márgenes, bordes, sombra, formato (16:9, 9:16, 1:1) y encuadre vertical. |
| `set_webcam` | Posición, tamaño, forma, espejo y reacción al zoom. |
| `set_cursor` | Tamaño, suavizado, efecto de clic, ocultar en tramos. |
| `add_text` / `add_arrow` / `add_blur` | Anotaciones y difuminado de datos sensibles. |
| `captions` | Generar subtítulos automáticos (ya existe en la app) y ajustarlos. |
| `undo` / `save_project` | Deshacer y guardar. |

### Etapa 2 — Que el agente "actúe" la demo mientras graba

| Herramienta | Qué hace |
| --- | --- |
| `move_mouse` | Mueve el cursor con trayectoria humana (curva, aceleración), con velocidad elegible. |
| `click` / `double_click` / `drag` | Clics y arrastres en coordenadas o sobre un elemento visible. |
| `type_text` | Escribe con ritmo humano (pausas, sin errores o con correcciones). |
| `press_keys` | Atajos (Ctrl+K, Enter, Esc). |
| `scroll` | Desplazamiento suave. |
| `focus_window` / `open_app` / `open_url` | Traer una ventana, abrir una app o una página. |
| `wait_for` | Esperar un texto o un cambio en pantalla (OCR o captura). |
| `run_demo` | Corre una lista de pasos mientras graba y deja **marcadores** con nombre en cada paso. |
| `add_marker` | Marca un momento ("acá aparece el resultado") para editar después. |

Implementación: un ayudante nativo chico `syka-input.exe` (SendInput de
Windows) firmado junto a los demás, controlado desde main. Seguridad:
solo mientras hay una grabación iniciada por el agente, la barra muestra
"Un agente está usando el mouse", **Esc o mover el mouse corta todo**, y la
primera vez la persona tiene que aprobarlo. Lista de apps permitidas.

### Etapa 3 — "Hacé un video" de una

`make_video({ brief, fuente, duración, formatos, destino })` como receta del
MCP (prompt + herramientas, no una caja negra):

1. Plan de tomas a partir del brief (qué mostrar y en qué orden).
2. Graba con `run_demo`, con marcadores por paso.
3. Edita sola: zooms en clics y resultados, corta tiempos muertos, acelera
   esperas, encuadre vertical que sigue al cursor, cámara si hay.
4. Revisa con `preview_frames` y corrige.
5. Exporta variantes (`export_variants`: 16:9 para YouTube, 9:16 para
   TikTok/Reels/Shorts, 1:1) y comprueba las **zonas de cada plataforma**
   (que nada importante quede tapado por la interfaz de la app).
6. Pasa el proyecto a Studio con una **nota de traspaso** (qué se hizo, los
   marcadores, qué falta), para que el agente de Studio siga con música,
   títulos y animaciones.

### Etapa 4 — Studio y Recorder como un solo flujo

- `transfer_to_studio` devuelve el id del proyecto de Studio y deja la nota
  de traspaso legible por el MCP de Studio.
- Los marcadores de Recorder llegan a Studio como marcadores de la línea de tiempo.
- Studio puede pedirle a Recorder una toma nueva ("regrabá el paso 3").

## Funciones extra interesantes

- **Assets reales de Syka Code**: grabar ventanas de Syka Code u otras apps
  tal como se ven, con su cursor real, sin mockups.
- **Retoma inteligente**: si un paso falla, `restart_recording` desde el
  último marcador y no desde el principio.
- **Privacidad automática**: difuminar correos, tokens y notificaciones
  detectados en pantalla antes de exportar.
- **Plantillas de video**: "demo de producto 30 s", "tutorial paso a paso",
  "antes/después", cada una con su ritmo de zooms y cortes.
- **Voz en off** a partir del guion, sincronizada con los marcadores.

## Orden sugerido

1. Etapa 1 completa (sin riesgo, el agente ya puede editar y revisar).
2. `run_demo` con mouse y teclado (etapa 2), con las salvaguardas.
3. Receta `make_video` y variantes por plataforma (etapa 3).
4. Integración de marcadores y nota de traspaso con Studio (etapa 4).
