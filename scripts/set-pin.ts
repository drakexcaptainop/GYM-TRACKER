// Uso: npm run set-pin -- <idPerfil> <PIN de 6 digitos>
// Imprime el SQL para pegar en la consola de D1. El PIN no se guarda en ningun archivo.
import { PIN_ITERATIONS, hashPin, newSalt } from "../worker/auth/pin.ts";

const [idArg, pin] = process.argv.slice(2);
const id = Number(idArg);
if (!Number.isInteger(id) || id < 1 || !pin || !/^\d{6}$/.test(pin)) {
  console.error("Uso: npm run set-pin -- <idPerfil> <PIN de 6 digitos>");
  process.exit(1);
}

const salt = newSalt();
const hash = await hashPin(pin, salt, PIN_ITERATIONS);
console.log(
  `UPDATE profiles SET pin_salt = '${salt}', pin_hash = '${hash}', pin_iterations = ${PIN_ITERATIONS} WHERE id = ${id};`,
);
console.log(`UPDATE login_lock SET failures = 0, locked_until = 0 WHERE profile_id = ${id};`);
