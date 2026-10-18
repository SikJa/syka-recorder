<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/media/readme-orb-dark.webp" />
    <img src="docs/media/readme-orb-light.webp" width="116" height="116" alt="Animated Syka Recorder orb" />
  </picture>
</p>
<h1 align="center">Syka Recorder</h1>
<p align="center"><b>Record your screen. Explain your idea. Continue in Syka Studio.</b></p>
<p align="center">
  <a href="https://github.com/SikJa/syka-recorder/releases/latest/download/Syka-Recorder-x64-Setup.exe"><img src="docs/media/download-en.svg" width="400" height="87" alt="Download now · Windows x64" /></a>
</p>
<p align="center">
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/source-AGPL--3.0-467b65" alt="AGPL-3.0 open source" /></a>
  <img src="https://img.shields.io/badge/Windows-x64-0078D4" alt="Windows x64" />
  <a href="https://github.com/webadderallorg/Recordly"><img src="https://img.shields.io/badge/based_on-Recordly-555" alt="Based on Recordly" /></a>
</p>
<p align="center"><a href="README.md">Español</a> · <b>English</b> · <a href="#installation">Installation</a> · <a href="#from-recorder-to-studio">Edit in Studio</a> · <a href="CREDITS.md">Credits</a></p>

**Syka Recorder is an independent fork of [Recordly](https://github.com/webadderallorg/Recordly), created by webadderall and its contributors.** It builds on Recordly's recorder and editor with Syka branding, live drawing tools and a bridge to editable [Syka Studio](https://github.com/SikJa/syka-studio) projects. We preserve the original project's open source code, history and attribution.

<p align="center"><img src="docs/media/recorder-editor.png" width="100%" alt="The real Syka Recorder editor with a background, frame and sample camera" /></p>
<p align="center"><sub>Application screenshot. Screen and camera content are demonstration material.</sub></p>

## From a recording to a project

| Record | Explain | Edit |
| --- | --- | --- |
| Screen, window or region; webcam, microphone and system audio. | Pen, line, arrow, shapes, highlighter, text and blur. | Cuts, speed, zooms, cursor, backgrounds, corners and shadows. |
| A floating toolbar you can move and minimize. | Close the tool panel while keeping drawing active. Undo with Ctrl+Z. | Fullscreen preview, MP4 export and editable Studio projects. |

No Recordly account required. Local recordings and projects. Recorder works on its own; Studio is optional for further editing.

## From Recorder to Studio

1. Finish recording and adjust the background, framing and camera in Recorder.
2. Select **Editar en Syka → Guardar y abrir en Studio** (Edit in Syka → Save and open in Studio).
3. Choose a folder. Recorder saves the project and opens your Studio installation.
4. Continue editing: media, cuts, background, frames, shadows, camera and audio tracks retain their editable structure.

<p align="center"><img src="docs/media/transfer-dialog.png" width="760" alt="Save and open in Syka Studio options" /></p>
<p align="center"><img src="docs/media/studio-project.png" width="100%" alt="The same composition open in Syka Studio" /></p>

<p align="center"><a href="https://github.com/SikJa/syka-recorder/releases/latest/download/Syka-Recorder-demo.mp4"><img src="docs/media/demo-preview.gif" width="768" alt="Real demo: MacOS Style background in Recorder and the same project edited in Studio" /></a></p>

**[Watch the full demo · 37 seconds](https://github.com/SikJa/syka-recorder/releases/latest/download/Syka-Recorder-demo.mp4)** · [Demo validation](docs/demo.md) · [Transfer details](docs/studio-transfer.md)

If Studio is missing, Recorder offers to **download it**, **locate an existing installation**, or **continue later**. Your project is already saved. Recorder discovers standard installations and Studio version folders; normal Studio upgrades do not depend on the developer's computer paths.

Share **the entire folder**, not just `manifest.json`. Native project media paths are relative. Accounts and profiles are not copied. Compatibility is verified against the available Studio version; future breaking changes to its format or CLI may require a Recorder update.

## Installation

**Windows x64.** Download the installer above, run it, and open Syka Recorder. No Node.js or development tools needed. This installer is not Authenticode-signed; Windows may display an unknown-publisher notice. Release checksums are included.

The source retains inherited support for other platforms, but this distribution and Studio integration are validated on Windows. Certified macOS/Linux installers are not available yet.

### Updates

Recorder checks stable releases from **this repository** at startup and periodically. An available version triggers a notification. You choose when to download and restart; it does not install on exit or interrupt a recording or unsaved project. Pushing source alone does not update the app: a release needs its installer, `.blockmap`, and `latest.yml` generated together.

## Current boundaries

- Drawings are burned into the recording. Ctrl+Z removes a mark from that point onward, not from frames already captured.
- Drawing shortcuts require Recorder focus. Blur uses a static sample.
- Recorded cursor and drawings remain part of the transferred video. Zoom-reactive webcam behavior becomes a fixed layer; the transfer dialog explains differences.
- This initial release was tested locally. Successful builds do not replace testing on different computers, cameras and audio devices.

## Development

Node.js 22+, npm, Visual Studio Build Tools and Windows SDK for native capture helpers.

```sh
npm ci
npm run dev
```

```sh
npm run typecheck
npm test
npm run build:win -- --publish never
```

The installer is written to `release/`. [Contributing](CONTRIBUTING.md) · [Release workflow](docs/releases.md) · [Report an issue](https://github.com/SikJa/syka-recorder/issues)

## Open source and credits

**Recordly, webadderall and its contributors** built the foundation of this application. We do not present that engine as our original work. Live drawing tools are adapted from **[Whispera](https://github.com/SikJa/Whispera)** under MIT. **Syka Studio** keeps its own repository and license; adapted MPL files retain their notices. The orb uses **thinking-orbs**, icons come from **Phosphor**, the typeface is **Inter**, and media processing uses **FFmpeg/ffprobe**.

Covered source and our modifications are released under **[AGPL-3.0](LICENSE.md)**. Third-party components keep their own licenses. Each release links its source, and installers include license notices.

**[Full credits](CREDITS.md)** · **[Third-party notices](THIRD_PARTY_NOTICES.md)** · [Original Recordly documentation](docs/upstream/README-Recordly.md)

Syka Recorder is independent; attribution does not imply affiliation or endorsement by the original authors.
