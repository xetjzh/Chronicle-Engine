import { execFileSync } from 'node:child_process';

// Check filenames only. Never read or print the contents of local configuration.
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const privateConfiguration = files.filter(file => /(?:^|\/)\.env(?:\.|$)/.test(file)
  && !/(?:^|\/)\.env(?:\.[^/]+)?\.example$/.test(file));
if (privateConfiguration.length) {
  console.error('Local environment files must be removed from Git tracking; retain only .env.example templates:');
  for (const file of privateConfiguration) console.error(`  ${file}`);
  process.exitCode = 1;
} else {
  console.log('Repository configuration check passed: no tracked local environment files.');
}
