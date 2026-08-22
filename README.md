# Strike — Style Director

Tu director de estilo personal. Mobile-first PWA que funciona como un sistema inteligente de guardarropa: registra prendas, las clasifica con IA, recomienda outfits priorizando lo que ya tenés, y construye memoria de tu estilo con el uso.

Stack: Next.js 16 (App Router) + Supabase + MiniMax (vision + reasoning) + `@imgly/background-removal` (cliente).

---

## Quick start

```bash
# 1. Instalar dependencias
nvm use 22  # o node 22+
npm install

# 2. Configurar env (ver .env.example)
cp .env.example .env.local
# Editar .env.local con tus claves

# 3. Pre-flight (valida que todo compile)
npm run preflight

# 4. Correr en dev
npm run dev
# → http://localhost:3000
```

Para deploy real a producción: ver [DEPLOY.md](./DEPLOY.md).

---

## Setup

### Variables de entorno (`.env.local`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server-only, nunca exponer

# MiniMax
MINIMAX_API_KEY=...
MINIMAX_BASE_URL=https://api.minimax.chat/v1
MINIMAX_VISION_MODEL=MiniMax-Text-01
MINIMAX_TEXT_MODEL=MiniMax-Text-01
```

Sin Supabase configurado, la app entra en **modo preview**: muestra la UI pero el auth está deshabilitado.

### Supabase

1. Crear proyecto en [supabase.com](https://supabase.com).
2. Aplicar la migración inicial:
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/0001_initial.sql
   ```
   O usar el SQL Editor en el dashboard.
3. Crear buckets de Storage (privados):
   - `garments`
   - `body-photos`
   - `references`
   - `fit-checks`
4. (Opcional) Cargar datos de seed reemplazando el UUID placeholder en `supabase/seed.sql`.

### MiniMax

Crear una API key en el dashboard de MiniMax. La app usa un endpoint compatible con `chat/completions` para visión y razonamiento.

---

## Arquitectura

```
app/
├── (auth)/login, signup                  # Email auth
├── onboarding/body-profile, style-dna    # Onboarding
├── (app)/                                # Rutas autenticadas
│   ├── page.tsx                          # Home
│   ├── closet/                           # MI CLOSET
│   ├── add/{capture,gallery,confirm}     # + Agregar flujo
│   ├── outfits/{new,results,build,[id]}  # Outfit engine
│   ├── inspire/                          # References + Wishlist
│   ├── profile/                          # Body + Style memory
│   └── audit/                            # Wardrobe audit
└── api/
    ├── ai/{recognize-garment,generate-outfit,analyze-reference}
    ├── style/update-from-feedback
    └── upload/sign

lib/
├── ai/{minimax,prompts,schemas}.ts       # AI client + Zod schemas
├── outfit-engine/rules.ts                # Local scoring rules
├── background-removal.ts                 # On-device (imgly)
└── supabase/{client,server,types}.ts

supabase/migrations/0001_initial.sql       # Schema completo (12 tablas + RLS)
```

### Modelo de datos (resumen)

12 tablas con RLS: `profiles`, `body_profiles`, `garments` (unifica clothing/sneakers/accessories), `references`, `outfits`, `outfit_items`, `wear_history`, `fit_checks`, `style_preferences`, `wishlist_items`, `ai_cache`, y un trigger que crea perfil automáticamente al registrarse.

Decisión clave: dos polos blancos boxy ⇒ dos filas separadas en `garments`. El `id` distingue cada pieza específica. La IA intenta matchear visualmente por embeddings (futuro), pero siempre permite crear una nueva entrada.

### Outfit engine

1. Lee closet del usuario + historial reciente + style memory.
2. Llama a MiniMax con prompt estructurado (JSON schema estricto vía Zod).
3. MiniMax devuelve 2-3 outfits con explicación (proporción, color, silueta, contexto, Style DNA).
4. Validamos que cada `garment_id` exista en el closet del usuario antes de persistir.
5. Cada outfit tiene score local de rotación + diversidad (ver `lib/outfit-engine/rules.ts`).

AI prompt incluye **Style DNA fijo**: Creative Amekaji Executive. Cuando el usuario cambie el Style DNA desde Profile, se inyectará en futuros prompts.

---

## User stories implementadas

| ID | Descripción | Estado |
|---|---|---|
| US01 | Registrar prenda (cámara/galería + AI + editar) | ✅ |
| US02 | Registrar sneaker (con prominencia + colorway) | ✅ |
| US03 | Registrar accesorio | ✅ |
| US04 | Pedir outfit por ocasión + texto libre | ✅ |
| US05 | Build around my sneakers | ✅ |
| US06 | Evitar repetir (rotación + historial en prompt) | ✅ |
| US07 | Fit check con foto + rating 4 botones | ✅ |
| US08 | References / Inspiration (separado del closet) | ✅ |
| US09 | Recrear reference con prendas del closet | ✅ |
| US10 | Wardrobe Audit (CORE/USEFUL/UNUSED/QUESTION/DUPLICATE) | ✅ |
| Sneaker Rotation | Dashboard de días sin usar + recomendación | ✅ |
| Wishlist | Estados inspiration/maybe/priority/dismissed/bought | ✅ |

---

## Roadmap (no implementado en MVP)

- Virtual try-on fotorealista (arquitectura lista, requiere modelo).
- Detección de duplicados por embedding visual (hoy: por signature de atributos).
- Wishlist UI completa (tabla existe, falta UI).
- Ecommerce, marketplace, social.
- Push notifications.
- App nativa iOS/Android (PWA primero; conversión a React Native factible).

---

## Cost optimization

- **Background removal on-device** (`@imgly/background-removal`) → $0.
- **AI cache por SHA256** de imagen → evita llamadas duplicadas.
- **Closet summary** (no imágenes) enviado al LLM → tokens mínimos.
- **Free tiers**: Supabase (500MB DB, 1GB storage, 50k MAU) y Vercel (100GB BW) cubren MVP.
- **Rate limiting** in-memory token-bucket en todos los endpoints AI:
  - `recognize-garment`: 10/hora/usuario
  - `generate-outfit`: 6/minuto/usuario
  - `analyze-reference` / `recreate-reference`: 20/hora/usuario
  - En producción reemplazar por Redis/Upstash para estado cross-instance.

---

## Comandos

```bash
npm run dev         # Dev server (Turbopack)
npm run build       # Production build
npm run start       # Run production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest (38 tests)
```

---

## Convenciones

- Mobile-first. Diseñá siempre 375px primero.
- Lenguaje humano: "¿Qué me pongo?" no "Generate Outfit".
- Toda clasificación de IA es editable por el usuario.
- Nunca eliminar prendas — archivar.
- Sin emojis decorativos (solo en UI de feedback ratings).
- Estética editorial: mucho espacio negativo, sans-serif, hairline borders.
