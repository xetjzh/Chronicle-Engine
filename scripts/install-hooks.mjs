import { execFileSync } from 'node:child_process';
let current = ''; try { current = execFileSync('git', ['config', '--local', '--get', 'core.hooksPath'], { encoding: 'utf8' }).trim(); } catch {}
if (current && current !== '.githooks') throw new Error('An existing custom hooks path is configured. Chain the credential scan into that hook rather than overwriting it.');
execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks']);
console.log('Repository pre-commit credential check enabled.');
