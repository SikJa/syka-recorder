import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Exercise the production loadFile URL used by the HUD and source picker.
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const documentUrl = pathToFileURL(path.join(root, "index.html"));
documentUrl.search = "?windowType=hud-overlay";
const html = await readFile(documentUrl, "utf8");
const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
assert(
	assets.some((asset) => /\.js$/.test(asset)),
	"Missing renderer entry script",
);
for (const asset of assets) {
	const resolved = new URL(asset, documentUrl);
	assert.equal(resolved.protocol, "file:", `Unexpected remote asset: ${asset}`);
	const relative = path.relative(root, fileURLToPath(resolved));
	assert(
		!relative.startsWith("..") && !path.isAbsolute(relative),
		`Asset escapes dist: ${asset}`,
	);
	await access(resolved);
}
console.log(`PASS: ${assets.length} renderer assets resolve inside dist using the HUD file URL.`);
