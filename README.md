# StudyFlow — Organizer Zadań Akademickich z Macierzą Eisenhowera

StudyFlow to responsywna aplikacja internetowa (PWA) stworzona z myślą o studentach, umożliwiająca organizację przedmiotów, kategorii i zadań akademickich oraz ich priorytetyzację na interaktywnej macierzy Eisenhowera.

---

## 🚀 Stos technologiczny

- **Frontend & Backend**: Next.js 14 (App Router), React 18, TypeScript (tryb `strict`)
- **UI & Komponenty**: Material UI (MUI v5) z responsywnym motywem i wsparciem urządzeń mobilnych
- **Baza danych & ORM**: PostgreSQL + Prisma ORM
- **Walidacja danych**: Zod
- **Uwierzytelnianie & Sesje**: Hasła hashowane przez `bcryptjs`, bezpieczne ciasteczka `HttpOnly` z podpisem JWT (`jose`), kontrola ról `STUDENT` i `ADMIN`
- **PWA**: Web App Manifest (`manifest.json` / `manifest.webmanifest`), ikony responsywne, Service Worker z bezpiecznym cache'owaniem zasobów statycznych
- **Testy**: Vitest (testy jednostkowe domeny macierzy Eisenhowera oraz kontroli dostępu)

---

## 📋 Wymagania wstępne

- **Node.js**: w wersji 18.x lub nowszej (rekomendowany LTS / Node 20 / 22)
- **NPM**: w wersji 9.x lub nowszej
- **PostgreSQL**: lokalny (np. przez Docker) lub zarządzany w chmurze (np. Supabase / Neon)

---

## 🛠️ Uruchomienie lokalne (krok po kroku)

### 1. Klonowanie repozytorium i instalacja zależności
```bash
npm install
```

### 2. Konfiguracja zmiennych środowiskowych
Skopiuj plik `.env.example` do `.env`:
```bash
cp .env.example .env
```
Domyślna zawartość pliku `.env` dla lokalnego środowiska Docker:
```env
DATABASE_URL="postgresql://studyflow:studyflow_password@localhost:5432/studyflow_db?schema=public"
SESSION_SECRET="studyflow_super_secret_jwt_key_must_be_at_least_32_characters_long_for_security"
ADMIN_USERNAME="*****"
ADMIN_PASSWORD="*******"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Google Calendar OAuth 2.0 (Google Cloud Console)
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
ENCRYPTION_KEY="studyflow_token_encryption_key_min_32_characters_long"
CRON_SECRET="studyflow_cron_background_sync_secret_key"
```

### 3. Uruchomienie bazy danych PostgreSQL (Docker)
W projekcie przygotowany jest plik `docker-compose.yml`:
```bash
docker run -d --name studyflow_postgres -p 5432:5432 -e POSTGRES_USER=studyflow -e POSTGRES_PASSWORD=studyflow_password -e POSTGRES_DB=studyflow_db postgres:16-alpine
```
*(lub `docker compose up -d` / `docker-compose up -d`)*

### 4. Synchronizacja bazy danych i wygenerowanie klienta Prisma
```bash
npm run prisma:generate
npm run prisma:push
```

### 5. Bezpieczna inicjalizacja konta administratora
Skrypt odczytuje dane administratora z `ADMIN_USERNAME` i `ADMIN_PASSWORD`:
```bash
npm run init-admin
```

### 6. Uruchomienie serwera deweloperskiego
```bash
npm run dev
```
Aplikacja będzie dostępna pod adresem: [http://localhost:3000](http://localhost:3000).

---

## 🧪 Skrypty NPM

- `npm run dev` — Uruchamia serwer deweloperski Next.js
- `npm run build` — Buduje zoptymalizowaną wersję produkcyjną
- `npm run start` — Uruchamia serwer produkcyjny
- `npm run typecheck` — Weryfikuje typy TypeScript (`tsc --noEmit`)
- `npm test` — Uruchamia zestaw testów jednostkowych Vitest
- `npm run init-admin` — Tworzy lub aktualizuje konto administratora ze zmiennych środowiskowych
- `npm run prisma:push` — Synchronizuje schemat bazy danych PostgreSQL
- `npm run prisma:generate` — Generuje klienta Prisma Client

---

## 🧭 Główne widoki aplikacji

- `/` — Strona główna (dla niezalogowanych: opis aplikacji, dla zalogowanych: przekierowanie do `/dashboard`)
- `/login` — Logowanie za pomocą loginu i hasła
- `/register` — Rejestracja nowego studenta (unikalny login niewrażliwy na wielkość liter)
- `/dashboard` — Główny pulpit z:
  - Interaktywną macierzą Eisenhowera (4 ćwiartki)
  - Licznikami aktywnych zadań, zadań na dziś/po terminie oraz przedmiotów
  - Listą najbliższych terminów
  - Szybkim przyciskiem tworzenia zadań
- `/tasks` — Pełna lista zadań z zaawansowanym filtrowaniem (przedmiot, kategoria, status, termin) i sortowaniem
- `/calendar` — Interaktywny kalendarz tygodniowy i dzienny:
  - Widok siatki 24h z oznaczeniem aktualnej godziny i paska całodniowego
  - Zunifikowane wydarzenia z Google Calendar i zadania StudyFlow
  - Niezależne filtry widoczności i modal ze szczegółami wydarzenia
  - Przycisk szybkiej synchronizacji „Synchronizuj teraz”
- `/subjects` — Zarządzanie przedmiotami (tworzenie, paleta kolorów, opisy, kaskadowe usuwanie z potwierdzeniem)
- `/subjects/[id]` — Szczegóły przedmiotu, zarządzanie jego kategoriami oraz przypisanymi zadaniami
- `/settings` — Ustawienia studenta:
  - Personalizacja progów macierzy Eisenhowera (Story Points, liczba dni)
  - Integracja Google Calendar: łączenie/odłączanie konta, wybór kalendarza, częstotliwość synchronizacji (1h, 3h, 6h), przełączniki widoczności
- `/admin` — Panel administracyjny dostępny wyłącznie dla roli `ADMIN` (zarządzanie kontami studentów z poszanowaniem prywatności treści zadań)

---

## 🎯 Zasady macierzy Eisenhowera

1. **Ważność (Oś pionowa)**:
   - Domyślnie automatyczna: `storyPoints >= importantStoryPointsThreshold` (domyślnie 6 SP).
   - Możliwość ręcznego nadpisania na poziomie zadania (`Ważne` lub `Nieważne`).
2. **Pilność (Oś pozioma)**:
   - Domyślnie automatyczna: termin dzisiaj, miniony lub przypadający w granicach `urgentWithinDays` (domyślnie ≤ 3 dni).
   - Zadanie bez terminu nie jest pilne.
   - Możliwość ręcznego nadpisania (`Pilne` lub `Niepilne`).
3. **Niezależność i przywracanie**:
   - Ręczne nadpisanie jednego wymiaru nie wpływa na drugi wymiar.
   - Użytkownik może w każdej chwili kliknąć "Przywróć automat".
4. **Zadania ukończone**:
   - Zadania oznaczone jako `DONE` są domyślnie ukrywane na macierzy aktywnych zadań, z możliwością włączenia podglądu przełącznikiem.

---

## 📱 Instalacja jako PWA

Aplikacja spełnia standardy Progressive Web App:
- Posiada plik manifestu `manifest.json` oraz ikony w formatach 192x192, 512x512 i maskable.
- Service Worker (`public/sw.js`) dba o buforowanie plików statycznych.
- Żadne prywatne dane użytkownika ani zapytania API nie są cache'owane w pamięci podręcznej Service Workera.
- Aplikację można zainstalować na ekranie głównym telefonu (iOS / Android) oraz jako aplikację desktopową w przeglądarce Chrome/Edge.

---

## 🌐 Wdrożenie na Vercel + Neon / Supabase

1. Załóż bezpłatny projekt PostgreSQL na [Neon.tech](https://neon.tech) lub [Supabase](https://supabase.com).
2. Skopiuj Connection String i ustaw w zmiennych środowiskowych Vercel jako `DATABASE_URL` (pamiętaj o dopisaniu `?sslmode=require`).
3. Ustaw silny `SESSION_SECRET` (dowolny losowy ciąg min. 32 znaków) oraz dane początkowe `ADMIN_USERNAME` i `ADMIN_PASSWORD`.
4. Po wdrożeniu na Vercel uruchom migrację:
   ```bash
   npx prisma db push
   npm run init-admin
   ```
Aplikacja jest w pełni gotowa do pracy produkcyjnej z bezpiecznym HTTPS i obsługą sesji `HttpOnly`.

