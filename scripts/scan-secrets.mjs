import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g],
  ['api-token', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b/g],
  ['google-api-key', /\bAIza[A-Za-z0-9_-]{35}\b/g],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
];
export function findSecrets(text, filename) {
  const matches = [];
  if (/(?:^|\/)\.env(?:\.|$)/.test(filename) && !/(?:^|\/)\.env(?:\.[^/]+)?\.example$/.test(filename)) matches.push({ file: filename, rule: 'private-environment-file', line: 1 });
  for (const [rule, pattern] of rules) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) matches.push({ file: filename, rule, line: text.slice(0, match.index).split('\n').length });
  }
  return matches;
}
export function scan(staged = false) {
  const names = execFileSync('git', staged ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'] : ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const findings = [];
  for (const file of names) {
    let bytes; try { bytes = staged ? execFileSync('git', ['show', `:${file}`], { maxBuffer: 25 * 1024 * 1024 }) : readFileSync(file); }
    catch { findings.push({ file, rule: 'file-not-scanned', line: 1 }); continue; }
    findings.push(...findSecrets('', file));
    if (bytes.includes(0)) continue;
    findings.push(...findSecrets(bytes.toString('utf8'), file).filter(item => item.rule !== 'private-environment-file'));
  }
  return findings;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const matches = scan(process.argv.includes('--staged'));
  for (const item of matches) console.error(`${item.file}:${item.line} [${item.rule}]`);
  if (matches.length) { console.error('Credential scan blocked this change. Remove credentials from the staged content; matched values are never printed.'); process.exitCode = 1; }
  else console.log('Credential scan passed for supported token formats and private environment filenames.');
}
