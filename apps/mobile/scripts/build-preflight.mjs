import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(resolve(mobileRoot, 'app.json'), 'utf8')).expo;
const environment = { ...process.env };
// Only public runtime settings are read; values are never logged.
for (const filename of ['.env', '.env.local']) {
  const path = resolve(mobileRoot, filename);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^(EXPO_PUBLIC_SUPABASE_(?:URL|PUBLISHABLE_KEY))=(.*)$/);
    if (match && !environment[match[1]]) environment[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
}
const failures = [];
if (!config.extra?.eas?.projectId || !/^[0-9a-f-]{36}$/i.test(config.extra.eas.projectId)) failures.push('Link the app to its intended Expo project.');
if (!config.owner) failures.push('Record the intended Expo owner in app.json.');
if (!config.android?.package || !/^[a-zA-Z]\w*(\.[a-zA-Z]\w*){2,}$/.test(config.android.package) || config.android.package.includes('placeholder')) failures.push('Confirm and configure the permanent Android application identifier.');
const url = environment.EXPO_PUBLIC_SUPABASE_URL;
const key = environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
try { if (!url || new URL(url).protocol !== 'https:' || url.includes('your-project')) throw new Error(); }
catch { failures.push('Configure the public Supabase HTTPS URL.'); }
if (!key || key.includes('your-public') || key.startsWith('sb_secret_')) failures.push('Configure the public Supabase publishable key, never a secret/service-role key.');
if (key?.split('.').length === 3) {
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (payload.role !== 'anon') failures.push('The legacy Supabase key must have the anon role.');
  } catch { failures.push('The Supabase key is malformed.'); }
}
if (failures.length) {
  console.error('Android build prerequisites remaining:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Local configuration prerequisites pass. Before submitting, confirm EAS development environment values, Android signing, Supabase callback allowlist, build note and quota.');
}
console.log('This command submits no EAS build. Provisional Android worker estimate: 15–30 minutes; queue wait unknown. Two buffer builds remain protected.');
