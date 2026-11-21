# Despliegue en Cloudflare (plan gratis)

Todo se hace desde el panel web de Cloudflare. El repositorio no despliega nada por sí mismo: no hay script `deploy` ni CI.

## 1. Subir el repositorio a Git

Sube el código a GitHub (ya está en `lrcmch/GYM-TRACKER`).

## 2. Crear la base D1

1. Panel de Cloudflare → **Storage & Databases → D1 → Create database**, nombre `gym-tracker`.
2. Copia su **Database ID** en `wrangler.jsonc` (reemplaza el `00000000-…` de relleno) y súbelo a Git.

## 3. Cargar migración, datos y PINs

En la pestaña **Console** de la base D1 pega, en este orden:

1. El contenido de `migrations/0001_init.sql`.
2. El seed: ejecuta `npm run seed -- Nombre1 Nombre2` (genera `seed/out/seed.sql`) y pega ese SQL.
3. Los PIN: `npm run set-pin -- 1 123456` y `npm run set-pin -- 2 654321` imprimen el SQL para cada perfil; pégalo. Los PIN no se guardan en ningún archivo.

## 4. Crear el Worker

1. **Workers & Pages → Create → Import a repository**, elige el repo.
2. Comando de build: `npm run build`. El Worker usa `wrangler.jsonc` (assets + binding `DB`).
3. En **Settings → Variables and Secrets** agrega el secreto cifrado `SESSION_SECRET` con una cadena larga aleatoria (por ejemplo, 48 caracteres). Si cambia, todas las sesiones se cierran.

## 5. Usarla

Abre la URL del Worker en el celular y usa **Agregar a pantalla de inicio**.

## Reiniciar un PIN

Ejecuta `npm run set-pin -- <id> <PIN nuevo>` y pega el SQL en la consola D1. También reinicia el bloqueo por intentos fallidos.

## Después del primer despliegue

- Mide un día de uso en el panel y confirma que el login cabe en los 10 ms de CPU del plan gratis. Si no cabe, baja las iteraciones PBKDF2 en `worker/auth/pin.ts`; el bloqueo tras 5 intentos es la defensa principal.
- Revisa que los límites gratis vigentes sigan siendo los de KTD5 del plan. `test/budget.test.ts` mide consultas y filas por recorrido.
