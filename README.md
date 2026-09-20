# Eleva System

Plataforma de agendamiento y gestión para clínicas estéticas, spas y negocios de belleza.
Construida con TanStack Start + React + Tailwind y Supabase como backend.

> El proyecto nació en Lovable y ahora se desarrolla localmente con Claude Code.
> La autenticación usa Supabase directamente (correo/contraseña y Google), sin el broker de Lovable.

## Requisitos

- Node.js 20+ y npm
- Un proyecto de Supabase (el actual: `tjiybeymcukkauoyfosd`)

## Puesta en marcha

```sh
npm install
cp .env.local.example .env.local   # y pega tu SUPABASE_SERVICE_ROLE_KEY
npm run dev                        # http://localhost:8080
```

### Variables de entorno

| Archivo        | Contenido                                                | ¿Se sube a GitHub? |
| -------------- | -------------------------------------------------------- | ------------------ |
| `.env`         | URL del proyecto y clave publicable (`sb_publishable_…`) | Sí                 |
| `.env.local`   | `SUPABASE_SERVICE_ROLE_KEY` (clave secreta)              | **No**             |

La clave secreta solo la usan las funciones del servidor (crear el negocio en el onboarding y
registrar reservas desde la página pública). Sin ella, el login funciona pero el onboarding falla.

## Ver la app desde otro dispositivo / compartir un enlace

```sh
npm run share
```

Arranca el servidor y abre un túnel público de Cloudflare. Imprime una URL
`https://xxxx.trycloudflare.com` que puedes pegar en cualquier navegador o compartir para validar.
La URL cambia en cada ejecución y deja de funcionar al cerrar el proceso (Ctrl+C).

En la misma red Wi-Fi también puedes usar `http://<IP-de-tu-PC>:8080` sin túnel.

## Autenticación

- **Correo y contraseña**: activo. Supabase envía un correo de confirmación al registrarse.
  Para entrar sin confirmar (útil en pruebas): Supabase → Authentication → Sign In / Providers → Email → desactiva *Confirm email*.
- **Google**: requiere activarlo en Supabase → Authentication → Sign In / Providers → Google, con un
  Client ID / Secret de Google Cloud. En Google Cloud, la URI de redirección autorizada es
  `https://tjiybeymcukkauoyfosd.supabase.co/auth/v1/callback`.
- En Supabase → Authentication → URL Configuration agrega a *Redirect URLs*: `http://localhost:8080/**`
  y la URL pública que uses (por ejemplo `https://*.trycloudflare.com/**`).

## Base de datos

El esquema vive en `supabase/migrations/`. Ya está aplicado en el proyecto `tjiybeymcukkauoyfosd`.
Para cambios nuevos, crea una migración y aplícala con el MCP de Supabase desde Claude Code
(o con `supabase db push` si usas la CLI).

## Scripts

| Comando           | Qué hace                                       |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Servidor de desarrollo en `localhost:8080`     |
| `npm run share`   | Dev server + enlace público para validar       |
| `npm run build`   | Build de producción (Nitro, target Cloudflare) |
| `npm run preview` | Sirve el build de producción                   |
| `npm run lint`    | ESLint                                         |
