import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';

// Read-only: inspect publishable tracked/untracked files without touching the index.
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean))];
const findings = [];
let checked = 0;
for (const file of files) {
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) continue; // Deleted files in an existing index are not published.
  checked++;
  if (/^(?:\.tmp|node_modules|dist|dist-electron|release|test-results|playwright-report)\//.test(file) || /(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.example') || /\.recordly$/.test(file)) findings.push(`${file}: local data/build artifact`);
  if (info.size > 95 * 1024 * 1024) findings.push(`${file}: exceeds GitHub ordinary-file budget`);
  if (!/\.(?:ts|tsx|js|mjs|cjs|json|md|yml|yaml|cmd|ps1)$/.test(file) || info.size > 3 * 1024 * 1024) continue;
  const source = await readFile(file, 'utf8');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}/.test(source)) findings.push(`${file}: potential credential (value not printed)`);
  if (/^(?:src|electron|scripts)\//.test(file) && !/\.test\./.test(file) && /[A-Z]:[\\/]+(?:Users[\\/]+(?:CHAMP|Sikora)|Code Apps|Syka Studio[\\/]+Datos)/i.test(source)) findings.push(`${file}: machine-specific runtime path`);
}
if (findings.length) { console.error(findings.join('\n')); process.exitCode = 1; }
else console.log(`PASS: ${checked} publishable files; no checked local artifacts, personal runtime paths or credential patterns. Heuristic audit, not a full secret/history scan.`);
