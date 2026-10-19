// Uso: node scripts/hash-password.mjs  → pide la contraseña y muestra el hash para APP_USERS.
import crypto from 'node:crypto';
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Contraseña: ', pw => {
  rl.close();
  if (!pw || pw.length < 10) { console.error('Usa al menos 10 caracteres.'); process.exit(1); }
  const salt = crypto.randomBytes(16), iterations = 210000;
  const hash = crypto.pbkdf2Sync(pw, salt, iterations, 32, 'sha256');
  console.log(`pbkdf2$sha256$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`);
});
