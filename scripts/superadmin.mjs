#!/usr/bin/env node
// Superadmin (host) account management. Runs only on a trusted machine with the Supabase
// secret key; the browser never gets this key. Local stack: key is read from `supabase status`.
// Hosted project: SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) env vars.
import { execFileSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  passwordError, superadminEmail, superadminRole, usernameError, usernameFromEmail,
} from '../src/auth/superadmin-account.ts';

const usage = `Használat: npm run superadmin -- <parancs> [felhasználónév] [--generate]

  create <név>          új superadmin (jelszót kér, vagy --generate)
  reset-password <név>  új jelszó (elfelejtett jelszóhoz)
  reset-mfa <név>       hitelesítő app törlése (elveszett telefonhoz); következő belépéskor újra beállítandó
  revoke <név>          superadmin jog visszavonása (a fiók és a kóstolók megmaradnak)
  list                  superadminok listája`;

function fail(message) {
  console.error(`Hiba: ${message}`);
  process.exit(1);
}

function connection() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (url && key) return { url, key, target: url };
  let status;
  try {
    status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch {
    fail('nincs SUPABASE_URL + SUPABASE_SECRET_KEY, és a helyi Supabase sem fut (`supabase start`).');
  }
  const localUrl = status.API_URL;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(localUrl ?? '')) fail('a helyi Supabase címe nem loopback.');
  const localKey = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
  if (!localKey) fail('a helyi Supabase nem adott titkos kulcsot.');
  return { url: localUrl, key: localKey, target: `${localUrl} (helyi)` };
}

function hiddenPrompt(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error('A jelszót terminálban kell megadni (vagy használd a --generate kapcsolót).'));
    process.stdout.write(question);
    let value = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\u0003') { process.stdout.write('\n'); process.exit(130); }
        if (char === '\r' || char === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off('data', onData);
          process.stdout.write('\n');
          return resolve(value);
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    process.stdin.on('data', onData);
  });
}

function generatePassword() {
  const sets = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789'];
  const all = sets.join('') + '-_.';
  const chars = sets.map((set) => set[randomInt(set.length)]);
  while (chars.length < 24) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function askPassword(generate) {
  if (generate) {
    const password = generatePassword();
    console.log(`\nGenerált jelszó (csak most látszik, tedd jelszókezelőbe):\n\n  ${password}\n`);
    return password;
  }
  const password = await hiddenPrompt('Új jelszó (min. 14 karakter, kis- és nagybetű, szám): ');
  const problem = passwordError(password);
  if (problem) fail(problem);
  if (await hiddenPrompt('Jelszó még egyszer: ') !== password) fail('a két jelszó nem egyezik.');
  return password;
}

async function findUser(admin, username) {
  const email = superadminEmail(username);
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`a felhasználók nem kérdezhetők le (${error.message}).`);
    const user = data.users.find((candidate) => candidate.email === email);
    if (user || data.users.length < 1000) return user ?? null;
  }
}

async function deleteFactors(admin, userId) {
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) fail(`a hitelesítők nem kérdezhetők le (${error.message}).`);
  for (const factor of data.factors) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ userId, id: factor.id });
    if (deleteError) fail(`a hitelesítő nem törölhető (${deleteError.message}).`);
  }
  return data.factors.length;
}

const [command, rawName] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const generate = process.argv.includes('--generate');
if (!command || ['-h', 'help'].includes(command)) { console.log(usage); process.exit(command ? 0 : 1); }
if (command !== 'list') {
  if (!rawName) fail(`hiányzó felhasználónév.\n\n${usage}`);
  const problem = usernameError(rawName);
  if (problem) fail(problem);
}
const username = rawName?.trim().toLowerCase();
const { url, key, target } = connection();
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
console.log(`Supabase: ${target}`);

if (command === 'create') {
  if (await findUser(admin, username)) fail(`a(z) "${username}" felhasználó már létezik. Jelszócsere: reset-password.`);
  const password = await askPassword(generate);
  const { error } = await admin.auth.admin.createUser({
    email: superadminEmail(username), password, email_confirm: true,
    app_metadata: { vakkostolo_role: superadminRole }, user_metadata: { username },
  });
  if (error) fail(`a fiók nem jött létre (${error.message}).`);
  console.log(`Kész: "${username}" superadmin. Első belépéskor a /host oldalon be kell állítani a hitelesítő appot.`);
} else if (command === 'reset-password') {
  const user = await findUser(admin, username);
  if (!user) fail(`nincs "${username}" felhasználó.`);
  const password = await askPassword(generate);
  const { error } = await admin.auth.admin.updateUserById(user.id, { password });
  if (error) fail(`a jelszó nem módosult (${error.message}).`);
  console.log('Kész: a jelszó megváltozott. A hitelesítő app változatlan.');
} else if (command === 'reset-mfa') {
  const user = await findUser(admin, username);
  if (!user) fail(`nincs "${username}" felhasználó.`);
  const removed = await deleteFactors(admin, user.id);
  console.log(`Kész: ${removed} hitelesítő törölve. A következő belépéskor újat kell beállítani.`);
} else if (command === 'revoke') {
  const user = await findUser(admin, username);
  if (!user) fail(`nincs "${username}" felhasználó.`);
  const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: { vakkostolo_role: null } });
  if (error) fail(`a jog nem vonható vissza (${error.message}).`);
  await deleteFactors(admin, user.id);
  console.log(`Kész: "${username}" már nem superadmin.`);
} else if (command === 'list') {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) fail(`a felhasználók nem kérdezhetők le (${error.message}).`);
  const admins = data.users.filter((user) => user.app_metadata?.vakkostolo_role === superadminRole);
  if (!admins.length) console.log('Nincs superadmin. Létrehozás: npm run superadmin -- create <név>');
  for (const user of admins) {
    const factors = (user.factors ?? []).filter((factor) => factor.status === 'verified').length;
    console.log(`- ${usernameFromEmail(user.email) ?? user.email} · hitelesítő app: ${factors ? 'beállítva' : 'NINCS'} · utolsó belépés: ${user.last_sign_in_at ?? '–'}`);
  }
} else {
  fail(`ismeretlen parancs: ${command}\n\n${usage}`);
}
