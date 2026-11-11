import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { login, BridgeError } from './client.js';

// npm run login --prefix services/claude-mcp -- asks for the calendar account once; the password is
// typed hidden and never stored, only the device's refresh token.

let muted = false;
const out = new Writable({
  write(chunk, _enc, cb) {
    if (!muted) process.stdout.write(chunk);
    cb();
  },
});
const rl = createInterface({ input: process.stdin, output: out, terminal: true });
// The prompt goes through readline itself (written before muting), so the terminal's redraw can't
// erase it; for the password, echo is muted right after the prompt is shown.
const ask = (q: string, hidden = false) =>
  new Promise<string>((resolve) => {
    muted = false;
    rl.question(q, (a) => {
      muted = false;
      if (hidden) process.stdout.write('\n');
      resolve(a.trim());
    });
    muted = hidden;
  });

const email = await ask('Correo de la app de calendario: ');
const password = await ask('Contraseña (no se muestra ni se guarda): ', true);
rl.close();
try {
  await login(email, password);
  console.log('Listo: el puente quedó registrado como el dispositivo "Claude". Puedes revocarlo desde la app.');
} catch (e) {
  console.error(e instanceof BridgeError ? e.message : e);
  process.exitCode = 1;
}
