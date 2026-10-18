import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ffmpeg from "ffmpeg-static";

// Encode every platform size from the approved master; never redraw the mark.
const root = process.cwd();
const source = path.join(root, "branding/syka-recorder/icon-master.png");
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const pngDir = path.join(root, "icons/icons/png");
const publicDir = path.join(root, "public/app-icons");
const winDir = path.join(root, "icons/icons/win");
for (const dir of [pngDir, publicDir, winDir]) await mkdir(dir, { recursive: true });
const images = new Map();
for (const size of sizes) {
	const output = path.join(pngDir, `${size}x${size}.png`);
	execFileSync(ffmpeg, [
		"-hide_banner",
		"-loglevel",
		"error",
		"-y",
		"-i",
		source,
		"-vf",
		`scale=${size}:${size}:flags=lanczos`,
		"-frames:v",
		"1",
		"-pix_fmt",
		"rgba",
		output,
	]);
	const png = await readFile(output);
	images.set(size, png);
	if (![24, 48].includes(size))
		await writeFile(path.join(publicDir, `syka-recorder-${size}.png`), png);
}

// ICO directory followed by PNG frames, supported by Electron and modern Windows.
const icoSizes = sizes.filter((size) => size <= 256);
const header = Buffer.alloc(6 + 16 * icoSizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
let offset = header.length;
for (const [index, size] of icoSizes.entries()) {
	const png = images.get(size);
	const entry = 6 + index * 16;
	header[entry] = header[entry + 1] = size === 256 ? 0 : size;
	header.writeUInt16LE(1, entry + 4);
	header.writeUInt16LE(32, entry + 6);
	header.writeUInt32LE(png.length, entry + 8);
	header.writeUInt32LE(offset, entry + 12);
	offset += png.length;
}
await writeFile(
	path.join(winDir, "icon.ico"),
	Buffer.concat([header, ...icoSizes.map((size) => images.get(size))]),
);
console.log(
	`Generated ${sizes.length} PNG sizes, 7 application icons and a ${icoSizes.length}-frame Windows ICO.`,
);
