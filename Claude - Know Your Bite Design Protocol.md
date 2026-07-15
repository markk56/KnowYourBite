# Claude — Know Your Bite Design & Branding Protocol

> **Célja:** Ez a dokumentum rögzíti a *Know Your Bite* app teljes vizuális arculatát, design rendszerét, hangulatát és architektúráját — hogy a nulláról újraépített app **ugyanazt a brandinget és stílust** kapja meg. A régi kód törlésre kerül; ez a fájl + a `brand-assets/` mappa + a `Replit Exports/KnowYourBite.zip` backup az egyetlen megőrzött referencia.
>
> Utoljára frissítve: 2026-07-15 · Készítette: Claude (a régi Replit-export kód elemzése alapján)

---

## 1. Mi ez az app? (Termék-lényeg)

**Know Your Bite** egy **étrend-tervező alkalmazás dietetikusoknak**. Segít gyors, rugalmas és valóban személyre szabott étrendeket összeállítani — táblázatokkal való küzdelem nélkül.

**A szív-lüktetés (core idea):** *fix kalóriás recept-blokkok.* Minden recept pontos kcal + makró bontással rendelkezik. A tervező ezeket keveri-párosítja, hogy elérje a kliens napi célértékeit.

**Kulcsjellemzők:**
- **Duális recept-formátum:** grammok (pontosság) + kézmértékek (egyszerűség, pl. „1 tenyér csirke (120 g)”).
- **Automatikus roll-up:** napi/heti kalória, makrók, rost, só összesítése + egyesített bevásárlólista.
- **Valós-életbeli szűrők:** idő, eszközök, elkészítési mód, diéta, allergének, konyha, költség, szezon.
- **Makró-korlátok (guardrails):** Zsír 25–35%, Fehérje 20–25%, Szénhidrát 45–60% — élő napi/heti követés.
- **Kliens-profil + auto kizárások:** allergiák, preferenciák, vallási/etikai kizárások, elérhető konyhai eszközök.
- **Többnyelvű export:** HU / RO / EN — nyomtatható PDF, telefonbarát listák.
- **Kliens-anamnézis:** részletes felmérés (assessment wizard), PDF exporttal.

**Felhasználó:** regisztrált dietetikus (pl. a demóban „Dr. Sarah Wilson · Registered Dietitian”). Az alcím a felületen: **„Dietitian Platform”**.

**Hangvétel:** professzionális, mégis meleg és megközelíthető; egyszerű, hétköznapi nyelv. A tényleges recept-tartalom **magyar nyelvű** (pl. „Keverd össze a joghurtot a citromlével…”).

---

## 2. A logó

A logó egy **kör alakú jelvény (badge)**, „organic / gardening” esztétikával:

- **Központi motívum:** egy **félbevágott, felnyitott kókuszdió** — realisztikus, festett stílusú illusztráció. Barna, rostos külső héj + fényes fehér belső hús.
- **Háttér:** meleg, telített **barna / taupe** korong (kb. `#6B5D4F`–`#5E5245` tónus).
- **Keret:** kettős **arany / bronz gradiens** gyűrű (fényes, fémes hatás), belül egy vékonyabb arany körvonal.
- **Ívelt felirat felül:** `KNOW YOUR BITE` — arany, ritkított (letter-spaced) verzál betűk.
- **Ívelt felirat alul:** `DIETETIKUS` — ugyanaz az arany, ritkított verzál stílus.

**Fájl:** [`brand-assets/know-your-bite-logo.jpg`](brand-assets/know-your-bite-logo.jpg) (258 KB, JPG, ~940×940 px).

**Használat az appban:**
- A bal oldali sidebar tetején, egy **10×10 (2.5rem) kör alakú konténerben**, amelynek háttere `from-primary to-secondary` (arany → olívazöld) gradiens, a logó képe pedig 8×8 (2rem) `object-contain rounded-full`.
- Mellette: `Know Your Bite` (lg, semibold) + `Dietitian Platform` (xs, muted).

> **Újraépítéskor:** a kókusz + arany badge a védjegy. Ha SVG/ikonos verzió kell, tartsd meg a *kör-badge* formát, a *kókusz* motívumot és az *arany-barna* párost.

---

## 3. Színpaletta

A rendszer **HSL CSS-változókkal** dolgozik (shadcn/ui minta), külön világos és sötét témával. A vezérszín egy **meleg arany/amber**, a másodlagos egy **olíva/zsálya zöld** — a barna szöveg-tónusokkal együtt „meleg, organikus, táplálkozás-fókuszú” hangulatot adnak.

### Világos téma (`:root`)

| Token | HSL | Kb. HEX | Szerep |
|---|---|---|---|
| `--background` | `hsl(0, 0%, 98%)` | `#FAFAFA` | Törtfehér app-háttér |
| `--foreground` | `hsl(36, 16%, 17%)` | `#2E2921` | Meleg sötétbarna szöveg |
| `--card` | `hsl(0, 0%, 100%)` | `#FFFFFF` | Fehér kártyák |
| `--primary` | `hsl(43, 74%, 52%)` | `#D9A227` | **Arany / amber** — CTA, aktív nav, kalória |
| `--primary-foreground` | `hsl(0, 0%, 100%)` | `#FFFFFF` | Fehér a primaryn |
| `--secondary` | `hsl(88, 24%, 53%)` | `#7BA05B` | **Olíva/zsálya zöld** — fehérje, szénhidrát |
| `--accent` | `hsl(88, 24%, 53%)` | `#7BA05B` | = secondary |
| `--muted` | `hsl(210, 11%, 96%)` | `#F1F3F5` | Halvány szürke panelek |
| `--muted-foreground` | `hsl(36, 9%, 47%)` | `#7C7367` | Másodlagos szöveg |
| `--destructive` | `hsl(0, 72%, 51%)` | `#DC2626` | Piros — törlés, hibák, badge |
| `--border` / `--input` | `hsl(214, 13%, 91%)` | `#E3E6EA` | Vékony szürke keretek |
| `--ring` | `hsl(43, 74%, 52%)` | `#D9A227` | Arany fókusz-gyűrű |
| `--sidebar` | `hsl(180, 6.67%, 97.06%)` | `#F6F7F7` | Sidebar háttere (halvány) |

### Chart / adatvizualizációs színek

| Token | HSL | Szerep |
|---|---|---|
| `--chart-1` | `hsl(43, 74%, 52%)` | Arany |
| `--chart-2` | `hsl(88, 24%, 53%)` | Olívazöld |
| `--chart-3` | `hsl(42, 92%, 56%)` | Élénk sárga/amber |
| `--chart-4` | `hsl(147, 78%, 42%)` | Smaragdzöld |
| `--chart-5` | `hsl(341, 75%, 51%)` | Magenta/pink |

### Sötét téma (`.dark`)

Meleg barna alapokra épül (nem semleges szürke!):
- `--background: hsl(36, 16%, 12%)` (`#231F19` — mélybarna), `--foreground: hsl(210, 11%, 96%)`.
- `--card / --popover: hsl(36, 16%, 15%)`.
- `--primary` változatlan arany `hsl(43, 74%, 52%)`; `--secondary/--accent` sötétebb olíva `hsl(88, 24%, 40%)`.
- `--border / --input: hsl(36, 16%, 25%)`.

### Makró-sávok színkódja (a tervezőben, hardcode)
- **Fehérje (P):** piros — `bg-red-*` / `hsl(0,72%,51%)` tónus
- **Zsír (F):** arany/sárga — `--primary`
- **Szénhidrát (C):** kék — `bg-blue-*`
- (A napi Makró Célok kártyán: Kalória = arany, Fehérje/Szénhidrát = zöld, Zsír = narancs progress-bar.)

---

## 4. Tipográfia

- **Fő betűtípus:** **Inter** (Google Fonts), súlyok: 300, 400, 500, 600, 700. Betöltés `@import` az `index.css` tetején.
  - `--font-sans: 'Inter', system-ui, sans-serif`
  - `--font-serif: Georgia, serif`
  - `--font-mono: Menlo, monospace`
- **Fejlécek:** semibold/bold, `tracking-tight` a nagy címeknél (pl. landing `text-5xl font-bold`).
- **Oldalcímek (topbar):** `text-2xl font-semibold`.
- **Kártyacímek:** `text-lg` / `text-xl`, semibold.
- **Másodlagos szöveg:** `text-sm` / `text-xs`, `text-muted-foreground`.
- Törzs: `font-sans antialiased`.

---

## 5. Forma, tér, hangulat (design-nyelv)

- **Sarkok / lekerekítés:** `--radius: 8px`. Származtatott: `lg = 8px`, `md = 6px`, `sm = 4px`. Kártyák `rounded-lg`/`rounded-xl`, gombok `rounded-md`, avatar/logo/badge `rounded-full`.
- **Árnyékok:** nagyon visszafogottak — a shadow-tokenek gyakorlatilag **átlátszóak** (`...52%, 0.00`). A mélységet inkább **finom szürke keretek** (`border-border`) és a fehér-kártya vs. törtfehér-háttér kontraszt adja. Hover-en enyhe `hover:shadow-md`.
- **Recept-kártya interakció:** `.recipe-card` → `hover:shadow-md hover:scale-[1.02]`, `transition-all 200ms`.
- **Átmenetek:** `.transition-smooth` = `all 0.2s ease-in-out`; makró-progress `300ms ease-out`.
- **Egyedi scrollbar:** vékony (6px), `bg-muted` sín, `muted-foreground` opacity-30 hüvelyk.
- **Térköz alap:** `--spacing: 0.25rem` (Tailwind 4-es skála), tág padding a kártyákon (`p-6`), 2–4 spacing a nav-elemek közt.
- **Általános érzet:** **tiszta, világos, professzionális dashboard**; törtfehér háttér + fehér kártyák + meleg arany akcentusok + olívazöld a „pozitív/egészséges” jelzésekre. Levegős, adat-központú, könnyen olvasható. Nem lapos-hideg, hanem **meleg és organikus**.

---

## 6. Elrendezés-minta (layout)

**Alkalmazás-váz:** klasszikus **sidebar + topbar + tartalom** admin/dashboard elrendezés.

### Sidebar (bal, `w-64`, `bg-sidebar`, jobb keret)
1. **Fejléc-blokk** (`p-6`, alsó keret): kör-badge logó + „Know Your Bite” / „Dietitian Platform”.
2. **Navigáció** (`p-4`, `space-y-2`), ikon + label, `lucide-react` ikonokkal:
   - **Dashboard** → `LayoutDashboard` → `/dashboard`
   - **Recipe Library** → `BookOpen` → `/recipes`
   - **Meal Planner** → `Calendar` → `/planner`
   - **Client Management** → `Users` → `/clients`
   - **Calendar** → `CalendarDays` → `/calendar`
   - **Shopping Lists** → `ShoppingCart` → `/shopping`
   - Aktív elem: `bg-sidebar-primary text-sidebar-primary-foreground` (arany kitöltés); inaktív hover: `hover:bg-muted`.
3. **Alsó user-profil blokk:** kör avatar (kezdőbetűk, `bg-primary`) + név + szerep.

### Topbar (`bg-card`, alsó keret, `px-6 py-4`)
- Bal: **aktuális oldal címe** (`text-2xl font-semibold`) + hosszú dátum (pl. „Thursday, October 2, 2025”).
- Jobb: **kereső** (`w-80`, bal oldali `Search` ikon, „Search recipes, clients…”) + **értesítés-harang** (piros `3` badge) + **arany „Create New Plan” gomb** (`+` ikonnal).

### Tartalom
- Törtfehér háttér, **fehér kártyák** (`Card`), tág paddinggel.
- Példa (Meal Planner): felül nap-navigáció (Day 1 of 7 + 1–7 kör-jelölők + Empty/Partial/Complete legenda), „Daily Macro Targets” kártya 4 makró-oszloppal (ikon + nagy szám + progress-bar + cél%), majd étkezés-slotok (Breakfast/Lunch/Dinner/Snacks) mint kártyák, mindegyikben makró-bontás és P/F/C színsáv.

---

## 7. Technikai architektúra (a stílus alapja)

> Az újraépítésnél a **branding kötelező**, a stack **ajánlott** (a régi kódot ez követte). Az újraépítés eldöntheti, tartja-e ugyanezt.

### Frontend
- **React 18 + TypeScript + Vite**
- **Routing:** Wouter (könnyű, kliensoldali)
- **UI komponensek:** **shadcn/ui** — stílus: **„new-york”**, baseColor: **neutral**, CSS-változós theming; Radix UI primitívekre + Tailwind CSS-re építve. A teljes `components/ui/*` készlet jelen volt (accordion, dialog, dropdown, form, table, tabs, toast, sidebar, chart, stb.).
- **Ikonok:** `lucide-react` (+ `react-icons`).
- **State:** TanStack Query (szerver-state).
- **Űrlapok:** React Hook Form + Zod + `@hookform/resolvers`.
- **Diagramok:** Recharts + Chart.js.
- **Animáció:** Framer Motion, `tailwindcss-animate`.
- **PDF:** jsPDF + jspdf-autotable (recept-, étrend-, anamnézis-export).
- **Alias-ok:** `@/components`, `@/lib`, `@/hooks`, `@/components/ui`, `@assets` (→ `attached_assets`).

### Backend
- **Node.js + Express (TypeScript, ESM)**, RESTful API, központi hibakezelő middleware.
- Vite dev-integráció szerveroldalról (`server/vite.ts`).

### Adatréteg
- **PostgreSQL + Drizzle ORM**, Neon (serverless) hosting, Drizzle migrációk.
- **Session:** PostgreSQL + `connect-pg-simple`.
- **Biztonsági őrök:** seed/migráció production-ben tiltva; `MemStorage` production-ben blokkolt (csak `DbStorage`).
- **Fő táblák (`shared/schema.ts`):** `users`, `clients`, `ingredients`, `ingredientConversions`, `recipeTemplates`, `recipeTemplateIngredients`, `recipeInstances`, `recipeInstanceIngredients`, `recipes`, `mealPlans`, `mealPlanDays`, `mealPlanCalendar`, `shoppingLists`, `calendarEvents`, `clientAnamnesis`, `dailyPrograms`, `clientProgress`, `sessions`. Teljes cascade-delete az adatintegritásért.

### Auth
- Replit Auth (OpenID Connect) + Passport.js + szerveroldali session PostgreSQL-ben. Minden app-útvonal védett; a `/` landing publikus.

### Domén-logika (megőrzendő üzleti szabályok)
- **Fix-kalóriás recept-blokkok**, tápérték roll-up, makró-guardrails (Zsír 25–35% / Fehérje 20–25% / Szénhidrát 45–60%).
- **Duális mérték** (gramm + kézmérték), USDA összetevő-kereső, tápérték-kalkulátor + validátor (`shared/nutrition-calculator.ts`, `nutrition-validator.ts`, `unit-converter.ts`).
- Recept template → instance modell (kliensre szabott, egyedi összetevő-módosításokkal, auto-recalc).
- Bevásárlólista-aggregálás store-szekciók szerint, HU/RO/EN.

---

## 8. „Definition of done” az újraépített arculathoz

Az új app akkor „márka-hű”, ha:
1. ✅ A **kókusz + arany kör-badge logó** ott van a sidebar tetején, „Know Your Bite” / „Dietitian Platform” felirattal.
2. ✅ **Inter** betűtípus, a fenti **HSL színtokenek** (arany primary `43,74%,52%` + olíva secondary `88,24%,53%`), világos + sötét téma.
3. ✅ **8px radius**, visszafogott árnyékok, finom szürke keretek, törtfehér háttér / fehér kártyák.
4. ✅ **Sidebar + topbar + kártyás tartalom** elrendezés, a 6 fő nav-ponttal.
5. ✅ **shadcn/ui „new-york”** komponens-nyelv, `lucide-react` ikonok.
6. ✅ Makró-vizualizáció a P=piros / F=arany / C=kék színkóddal.
7. ✅ Meleg, professzionális, organikus, adat-központú, dietetikus-fókuszú hangulat.

---

## 9. Megőrzött referenciák (ebben a mappában)

- [`brand-assets/know-your-bite-logo.jpg`](brand-assets/know-your-bite-logo.jpg) — az eredeti logó.
- [`brand-assets/reference-meal-planner-ui.png`](brand-assets/reference-meal-planner-ui.png) — teljes Meal Planner képernyő (elrendezés, színek élőben).
- [`brand-assets/reference-recipe-form-ui.png`](brand-assets/reference-recipe-form-ui.png) — recept-űrlap (input-stílus, gombok, magyar tartalom).
- [`brand-assets/original-product-brief.txt`](brand-assets/original-product-brief.txt) — az eredeti termék-brief (teljes funkciólista).
- `Replit Exports/KnowYourBite.zip` — **a teljes régi kódbázis backupja** (client + server + shared + migrations + attached_assets). Ez a végső biztonsági háló, ha bármelyik régi részletre szükség lenne.
