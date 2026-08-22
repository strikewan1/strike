# Deploy Runbook — Strike

Setup completo desde cero hasta producción en **~20 minutos**.

---

## Pre-requisitos

- Node.js 22+ (`node --version`)
- npm 10+
- Cuenta en [Supabase](https://supabase.com) (free tier sirve)
- Cuenta en [Vercel](https://vercel.com) (free tier sirve)
- API key de MiniMax (chat completions endpoint, formato OpenAI-compatible)
- GitHub account (para CI/CD y deploys automáticos)

---

## Paso 1 — Pre-flight local (1 min)

Ejecutá el script de validación antes de tocar nada externo:

```bash
cd /Volumes/DataDocs/OpenCode/strike
npm install
npm run preflight
```

El script verifica:
- Que `node --version >= 22`
- Que las env vars requeridas estén presentes (formato, no valores reales)
- Que el código compile (`npm run build`)
- Que los tests pasen (`npm test`)

Si algo falla, NO sigas. Arreglá primero.

---

## Paso 2 — Crear proyecto Supabase (5 min)

1. Andá a [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. **Name**: `strike-prod` (o el que prefieras)
3. **Database password**: generá uno fuerte, **guardalo** (lo necesitás)
4. **Region**: elegí el más cercano a tus usuarios (default: `us-east-1`)
5. Click **Create new project** → esperá ~2 min

### 2.1 — Obtener credenciales

En el dashboard del proyecto:

- **Project URL**: Settings → API → Project URL → copiá
  Ej: `https://abcdefgh.supabase.co`
- **anon public key**: Settings → API → Project API keys → `anon` `public` → copiá
- **service_role key**: Settings → API → Project API keys → `service_role` → copiá
  ⚠️ **NUNCA expongas esta clave al cliente**

### 2.2 — Aplicar migraciones

Opción A — SQL Editor (más fácil):

1. Dashboard → **SQL Editor** → **New query**
2. Pegá el contenido de `supabase/migrations/0001_initial.sql` → Run
3. Nueva query → pegá `supabase/migrations/0002_storage_buckets.sql` → Run

Opción B — CLI (si tenés `supabase` CLI instalado):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 2.3 — Verificar

```sql
-- En SQL Editor
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Deberías ver 11 tablas: `ai_cache`, `body_profiles`, `fit_checks`, `garments`, `outfit_items`, `outfits`, `profiles`, `references`, `style_preferences`, `wear_history`, `wishlist_items`.

Y los buckets:

```sql
SELECT id FROM storage.buckets ORDER BY id;
```

Deberías ver: `body-photos`, `fit-checks`, `garments`, `references`.

---

## Paso 3 — Configurar MiniMax (2 min)

Si todavía no tenés key:

1. Creá cuenta en MiniMax
2. Dashboard → API Keys → **Create new key**
3. Copiala

El endpoint base y modelo default ya están en `.env.example`. Si tu plan usa otro modelo, ajustá:

```bash
MINIMAX_BASE_URL=https://api.minimax.chat/v1
MINIMAX_VISION_MODEL=MiniMax-Text-01
MINIMAX_TEXT_MODEL=MiniMax-Text-01
```

---

## Paso 4 — Deploy a Vercel (10 min)

### 4.1 — Push a GitHub

```bash
cd /Volumes/DataDocs/OpenCode/strike
git init   # si no estaba
git add .
git commit -m "Initial commit"
gh repo create strike --public --source=. --remote=origin --push
```

(o creá el repo manualmente desde github.com/new y hacé push)

### 4.2 — Importar en Vercel

1. Andá a [vercel.com/new](https://vercel.com/new)
2. **Import** tu repo de GitHub
3. Vercel detecta Next.js automáticamente
4. **NO deployes todavía** — primero configurá env vars

### 4.3 — Configurar environment variables en Vercel

Settings → Environment Variables → agregar las siguientes:

| Key | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Production only ⚠️ |
| `MINIMAX_API_KEY` | `ey...` | Production, Preview |
| `MINIMAX_BASE_URL` | `https://api.minimax.chat/v1` | Production, Preview |
| `MINIMAX_VISION_MODEL` | `MiniMax-Text-01` | Production, Preview |
| `MINIMAX_TEXT_MODEL` | `MiniMax-Text-01` | Production, Preview |
| `NEXT_PUBLIC_APP_URL` | `https://strike-tu-usuario.vercel.app` | Production |

**Opcionales para producción real**:

| Key | Para qué |
|---|---|
| `SENTRY_DSN` | Error tracking en producción |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side errors |
| `SENTRY_ORG` | Sentry org slug |
| `SENTRY_PROJECT` | Sentry project slug |
| `SENTRY_TRACES_SAMPLE_RATE` | Default `0.1` (10% de requests) |

### 4.4 — Deploy

Click **Deploy**. Vercel hace `npm install && npm run build`. Tomá café ☕ (3-5 min).

Si todo va bien:
- ✅ Build succeeded
- ✅ URL: `https://strike-tu-usuario.vercel.app`

### 4.5 — Configurar Auth en Supabase

Para que el signup funcione:

1. Supabase dashboard → **Authentication** → **URL Configuration**
2. **Site URL**: `https://strike-tu-usuario.vercel.app`
3. **Redirect URLs**: agregar `https://strike-tu-usuario.vercel.app/**`
4. **Email Templates** (opcional): editá el template de confirmación para que matchee tu marca

### 4.6 — Primer test end-to-end

1. Abrí la URL en el navegador del celular
2. Click "Crear cuenta" → email + password
3. Verificá que llegue el email de confirmación (o que se loguee directo si tenés confirmación off)
4. Pasá por el onboarding (body profile + style DNA)
5. Andá a "Agregar prenda" → tomá una foto
6. Esperá ~5-10 segundos mientras la IA clasifica
7. Revisá que la categoría/fit/color estén bien → Guardar
8. Andá a "¿Qué me pongo?" → elegí una ocasión → 3 outfits

Si todo eso funciona, **deploy exitoso**.

---

## Post-deploy

### Monitoreo

- Vercel Dashboard → tu proyecto → **Logs** para errores runtime
- Vercel → **Analytics** para tráfico
- Supabase → **Logs** para queries lentas / errores DB
- Opcional: conectá Sentry desde el día 1

### Backup de DB

Supabase free tier hace backup automático cada 24h. Para backups bajo demanda:

```bash
supabase db dump --project-ref <ref> > backup.sql
```

### Costos esperados (estimado free tier)

| Recurso | Free tier | Lo que vas a usar |
|---|---|---|
| Vercel bandwidth | 100 GB/mes | ~1-5 GB/mes con uso real |
| Vercel builds | 6,000 min/mes | ~20 min/mes |
| Supabase DB | 500 MB | ~50 MB con seed + uso |
| Supabase Storage | 1 GB | ~200 MB con 50 prendas |
| Supabase Auth | 50k MAU | <100 MAU |
| MiniMax API | según plan | ~$5-20/mes con uso moderado |

---

## Troubleshooting

### Build falla con "Module not found"
```bash
rm -rf .next node_modules
npm install
npm run build
```

### CSP errors en consola del browser
Los headers CSP son estrictos. Si ves errores tipo "Refused to connect to X", agregá el dominio en `next.config.ts` (función `headers()`).

### MiniMax 401/403
Verificá que `MINIMAX_API_KEY` esté bien copiada en Vercel. Probá el endpoint directamente:
```bash
curl -H "Authorization: Bearer $MINIMAX_API_KEY" https://api.minimax.chat/v1/models
```

### Storage upload falla con 403
Las políticas RLS están bien seteadas en `0002_storage_buckets.sql`. Verificá que las migraciones se corrieron todas.

### Después de deployar, las prendas no se ven
- Verificá que `NEXT_PUBLIC_SUPABASE_URL` esté bien (sin slash al final)
- Vercel → Settings → Domains → verificá que el dominio esté configurado
- En el código, las URLs de Storage se generan con `supabase.storage.from(bucket).getPublicUrl(path)`. Si la bucket es `private`, la URL es signed (con expiry). El código actual usa publicUrl que requiere bucket pública.

Para corregir: si tus buckets son privadas, modificá el helper para que use signed URLs o cambiá las policies para que `getPublicUrl` funcione con buckets privadas.

---

## Próximos pasos

1. Configurar CI con GitHub Actions (`.github/workflows/ci.yml`)
2. Configurar auto-deploy en cada push a main
3. Configurar preview deployments en cada PR
4. Apuntar dominio custom (`strike.app` o similar)
5. Activar Sentry
