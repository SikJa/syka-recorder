import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const repository = 'SikJa/syka-recorder';
if (process.env.GITHUB_REPOSITORY !== repository) throw new Error('Release must run in ' + repository);
if (process.env.GITHUB_REF !== `refs/tags/v${pkg.version}`) throw new Error('Release tag must match package.json version');
if (pkg.repository.url !== `https://github.com/${repository}.git`) throw new Error('Unexpected package repository');
console.log(`Release destination verified: ${repository} v${pkg.version}`);
