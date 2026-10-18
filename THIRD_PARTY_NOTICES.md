# Third-party notices

## Recordly — original application

Syka Recorder is a modified, independent fork of [Recordly](https://github.com/webadderallorg/Recordly),
created by webadderall and the Recordly contributors. Its screen recorder, editor,
timeline, capture and export architecture are the foundation of this application.
Original authors retain their copyright. The covered source and Syka modifications
are distributed under the GNU Affero General Public License version 3; see
[LICENSE.md](LICENSE.md). The original Git history and upstream documentation are
preserved. This fork is not an official Recordly release or endorsement.

Source for every Recorder release is available at https://github.com/SikJa/syka-recorder.

## FFmpeg and ffprobe

Media processing uses FFmpeg and ffprobe, Copyright the FFmpeg developers.
Windows binaries are bundled through `ffmpeg-static` and `ffprobe-static` and keep
their own licenses. `ffmpeg-static` is distributed under GPL-3.0; its license and
the ffprobe package's MIT notice are included under `docs/licenses` and installed
in `licenses/third-party`. FFmpeg build and source information:

- https://ffmpeg.org/download.html
- https://github.com/eugeneware/ffmpeg-static
- https://github.com/joshwnj/ffprobe-static
- https://www.gyan.dev/ffmpeg/builds/

Inspect the bundled binaries with `-version` and `-L` for their exact configuration
and license. Their independent licenses are not replaced by Recorder's license.

The Windows 1.4.0 distribution bundles FFmpeg 6.1.1 (Gyan essentials, GPL v3)
and ffprobe 4.0.2 (GPL v3). The MIT license of the `ffprobe-static` npm wrapper
does **not** cover the ffprobe executable. FFmpeg's build configuration, license
and exact source revision are preserved in
[`docs/licenses/FFmpeg-Windows-build.txt`](docs/licenses/FFmpeg-Windows-build.txt).
FFprobe 4.0.2 upstream source: https://github.com/FFmpeg/FFmpeg/tree/n4.0.2.

## Whispera screen drawing

The live recording drawing engine in `src/components/launch/drawing/screen-annotations.ts`
is adapted from Whispera, copyright (c) 2026 SikJa and Whispera contributors (MIT).
The original license is included in `src/components/launch/drawing/LICENSE-Whispera.txt`.
The native overlay integration and toolbar retain Syka Recorder's existing Electron
runtime and visual components.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Voom

Recordly Share includes code adapted from the Voom project:

- Project: [Voom](https://github.com/aritropaul/voom)
- Adapted component: `services/recordly-share/worker`
- License: MIT
- Copyright © 2026 Aritro Paul
- Upstream reference: `c1c0350ed610b0c9bc4a307fcc6a01aab0f926f9`

Recordly changes include product branding, desktop publishing integration,
authenticated commenting, local-development configuration, and viewer styling.

The Voom software is provided under the following license:

> MIT License
>
> Copyright (c) 2026 Aritro Paul
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## Phosphor Icons

Interface icons come from [Phosphor Icons](https://github.com/phosphor-icons/react) (`@phosphor-icons/react`), licensed under the MIT License. Copyright (c) 2020 Phosphor Icons.

> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## Inter

Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter).

Inter is licensed under the SIL Open Font License, Version 1.1. The variable regular and italic fonts are the same files Syka Studio bundles. The full license is included in [src/assets/fonts/inter/OFL.txt](src/assets/fonts/inter/OFL.txt).

## Syka orb icon (thinking-orbs)

The application icon is Syka Studio's orb, rendered with [thinking-orbs](https://github.com/Jakubantalik/thinking-orbs) 0.3.1, Copyright (c) 2026 Jakub Antalik, MIT License. The notice is kept in [branding/syka-orb/LICENSE.thinking-orbs.txt](branding/syka-orb/LICENSE.thinking-orbs.txt).

## Syka Studio project format

`electron/syka-transfer/studioMask.ts` and `electron/syka-transfer/composition.ts`
are adapted from Syka Studio (`packages/assets/src/mask.ts` and
`apps/desktop/src/recorder-import/composition.ts`), under the Mozilla Public
License 2.0. Their source headers retain that notice. These adaptations add
native editable projects, webcam mattes, crop geometry and separate shadow assets
to the Recorder transfer package. The MPL text is available at
https://mozilla.org/MPL/2.0/.

## Removed from this fork

Syka Recorder does not ship the bundled wallpapers, the macOS/Tahoe/Golden Gate and Windows 11 cursor artwork, the Solar icon set or the DM Sans font that upstream Recordly includes.

## Animated Syka orb

The dashboard uses the original composing engine from thinking-orbs 0.3.1 by Jakub Antalik, as used by Syka Studio. The unmodified engine is vendored in `src/lib/vendor/thinking-orbs/engine.js`; its MIT license is included alongside it. Animation uses Studio's header preset and respects reduced motion and visibility.
