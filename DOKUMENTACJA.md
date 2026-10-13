# StudyFlow — Dokumentacja Funkcjonalna i Architektoniczna

StudyFlow to responsywna aplikacja internetowa (zbudowana w standardzie Progressive Web App — PWA) stworzona z myślą o studentach. Służy do organizacji nauki, hierarchizacji materiału akademickiego, automatycznej priorytetyzacji zadań za pomocą Macierzy Eisenhowera oraz śledzenia czasu poświęconego na naukę.

---

## 1. Cel i przeznaczenie aplikacji

Głównym celem aplikacji jest wyeliminowanie chaosu w planowaniu nauki i przygotowaniach do zajęć akademickich poprzez połączenie czterech filarów:
1. **Hierarchii akademickiej:** Przedmiot $\rightarrow$ Kategorie modułowe $\rightarrow$ Konkretne zadania.
2. **Inteligentnej priorytetyzacji:** Automatyczny podział zadań na 4 ćwiartki Macierzy Eisenhowera z możliwością ręcznego nadpisywania.
3. **Planowania w horyzoncie czasowym:** Przegląd zadań na najbliższe dni (np. domyślnie 7 dni) oraz podział na interwały/tygodnie w przód.
4. **Śledzenia czasu nauki (Time Tracking):** Dedykowany stoper z trybem pełnoekranowym (Zen Mode) oraz agregacja statystyk czasu na poziomie zadań i całych przedmiotów.

---

## 2. Kluczowe moduły i funkcjonalności

### 🗂️ A. Zarządzanie strukturą przedmiotów (`/subjects`, `/subjects/[id]`)
- **Katalog przedmiotów:**
  - Tworzenie, edycja i usuwanie przedmiotów akademickich (np. *Analiza Matematyczna*, *Architektura Komputerów*).
  - Własna paleta barw (color-picker ułatwiający szybką identyfikację wizualną w widokach zadań i kalendarza) oraz pole na opisy/sylabusa.
  - Kaskadowe usuwanie z zabezpieczeniem (usunięcie przedmiotu usuwa powiązane kategorie i zadania po potwierdzeniu).
- **Kategorie modułowe (`/subjects/[id]`):**
  - Podział danego przedmiotu na etapy lub formy zajęć (np. *Wykłady*, *Laboratoria*, *Projekty*, *Kolokwia*).
  - Grupowanie zadań w ramach poszczególnych kategorii.

---

### 🎯 B. Pulpit i Macierz Eisenhowera (`/dashboard`)
Główny pulpit studenta prezentuje interaktywną Macierz Eisenhowera podzieloną na 4 ćwiartki decyzyjne:
1. **Ćwiartka I (Ważne i Pilne):** *Zrób natychmiast* (zadania priorytetowe z bliskim terminem lub dużym nakładem pracy).
2. **Ćwiartka II (Ważne i Niepilne):** *Zaplanuj* (kluczowe projekty, nauka długofalowa).
3. **Ćwiartka III (Nieważne i Pilne):** *Załatw szybko / Wydeleguj* (drobne formalności, powtarzalne krótkie zadania).
4. **Ćwiartka IV (Nieważne i Niepilne):** *Odrzuć / Na wolny czas* (zadania poboczne, opcjonalne).

#### Zasady działania automatycznej klasyfikacji:
- **Ważność (Oś pionowa):**
  - Wyliczana automatycznie na podstawie punktów nakładu pracy (**Story Points 1–10**).
  - Zadanie jest uznawane za ważne, jeśli jego Story Points $\ge$ próg ważności użytkownika (domyślnie $\ge 6$).
- **Pilność (Oś pozioma):**
  - Wyliczana automatycznie na podstawie daty oddania (**Due Date**).
  - Zadanie jest pilne, gdy termin upływa za $\le$ zdefiniowaną liczbę dni (domyślnie $\le 3$ dni) lub minął. Zadania bez terminu są domyślnie niepilne.
- **Ręczne nadpisywanie:** Student może w każdym zadaniu ręcznie wymusić flagę (*Ważne / Nieważne* oraz *Pilne / Niepilne*) lub w dowolnym momencie kliknąć *„Przywróć automat”*.
- **Przełącznik widoków:** Możliwość przełączania pulpitu między Macierzą Eisenhowera a Tablicą Kanban (ze stanami: *Nowe*, *Do zrobienia*, *W toku*, *Ukończone*).

---

### 📅 C. Lista zadań z horyzontem czasowym (`/tasks`)
- **Domyślny horyzont czasowy:** Wyświetlanie zadań na najbliższe dni (domyślnie 7 dni w przód) oraz zadań przeterminowanych i bez terminu.
- **Wybór przedziałów / tygodni w przód (Select):**
  - Zadania odleglejsze w czasie można przeglądać wybierając konkretne przedziały czasowe (np. *Tydzień 2: [od-do]*, *Tydzień 3: [od-do]* lub *Wszystkie przyszłe*).
- **Zaawansowane filtry i wyszukiwanie:**
  - Filtrowanie po przedmiocie, kategorii, statusie zadania.
  - Wyszukiwanie pełnotekstowe w tytułach i opisach.
  - Sortowanie po dacie oddania, priorytecie lub punktach Story Points.

---

### ⏱️ D. Stoper i Pomiar Czasu Nauki (`/tasks/[id]`)
- **Dedykowany ekran zadania:**
  - Pełny widok z opisem, terminem, powiązanym przedmiotem, kategorią i historią pracy.
- **Interaktywny stoper:**
  - Opcje *Start*, *Pauza*, *Zapisz sesję*, *Reset*.
  - Możliwość dodania notatki do zarejestrowanego bloku czasu (np. *„Przerobienie zadań 1-5 z listy”*).
  - Odporność na odświeżenie strony podczas pomiaru czasu (stan stopera zachowywany w `localStorage`).
- **Tryb pełnoekranowy (Focus / Zen Mode):**
  - Możliwość włączenia stopera na pełnym ekranie monitora bez elementów rozpraszających uwagę.
- **Historia sesji czasowych:** Pełny wykaz zarejestrowanych podejść do zadania z datami i czasem trwania.

---

### 📊 E. Statystyki czasu w przedmiocie (`/subjects/[id]`)
Na stronie szczegółów przedmiotu aplikacja automatycznie podsumowuje zaangażowanie studenta:
1. **Łączny czas:** Całkowita suma czasu spędzonego na wszystkich zadaniach z tego przedmiotu (np. `3 godz. 45 min`).
2. **Zadania ze stoperem:** Liczba zadań z zarejestrowanym czasem względem wszystkich zadań (np. `4 / 10`).
3. **Średni czas / zadanie:** Średni czas przypadający na zadanie z pomiarem.
4. **Wskaźnik ukończenia:** Procent i liczba zadań ze statusem *DONE*.
5. **Czas per Kategoria:** Plakietki informujące, ile czasu pochłonęły poszczególne kategorie przedmiotu.
6. **Tabela zadań:** Kolumna z zarejestrowanym czasem oraz bezpośredni link do stopera.

---

### ⚙️ F. Personalizacja i Konfiguracja (`/settings`)
Każdy student może spersonalizować algorytmy aplikacji pod swój styl nauki:
- **Próg punktów Story Points dla ważności:** (wartość od 1 do 10).
- **Próg dni do terminu dla pilności:** (od ilu dni przed terminem zadanie staje się pilne).
- **Domyślny horyzont czasowy listy zadań:** (domyślny okres, np. 7 dni).

---

### 🛡️ G. Bezpieczeństwo i Administracja (`/admin`, `/login`, `/register`)
- **Autentykacja i Sesje:**
  - Bezpieczne logowanie i rejestracja z unikalnymi nazwami użytkowników (case-insensitive).
  - Szyfrowanie haseł algorytmem `bcryptjs`.
  - Sesje oparte o bezpieczne ciasteczka `HttpOnly` z podpisem JWT (`jose`).
  - Pełna separacja danych — studenci nie mają wglądu w dane innych użytkowników.
- **Panel Administratora (`/admin`):**
  - Dostępny wyłącznie dla roli `ADMIN`.
  - Zarządzanie kontami użytkowników (reset haseł, aktywacja/blokada) z poszanowaniem prywatności treści zadań studentów.

---

### 📱 H. PWA (Progressive Web App)
- Pełna zgodność ze standardem PWA: plik manifestu `manifest.json`, dedykowane ikony (w tym maskable) oraz Service Worker (`public/sw.js`).
- Możliwość instalacji aplikacji na telefonach z systemem Android i iOS oraz na komputerach (Chrome, Edge) jako aplikacja okienkowa.

---

---

### 📅 I. Kalendarz tygodniowy i integracja z Google Calendar (`/calendar`, `/settings`)
Aplikacja udostępnia interaktywny kalendarz akademicki łączący wydarzenia z Google Calendar oraz zadania StudyFlow w jednym spójnym widoku:
- **Widok tygodniowy i dzienny (`/calendar`):**
  - Siatka 24-godzinna (od 00:00 do 23:00) z precyzyjnym pozycjonowaniem bloków na podstawie czasu rozpoczęcia i zakończenia.
  - Pasek wydarzeń całodniowych (*All-Day*).
  - Czerwona linia bieżącego czasu w aktualnym dniu.
  - Nawigacja między tygodniami / dniami, przycisk *„Dzisiaj”*.
  - Okno modalne ze szczegółami wydarzenia (tytuł, godziny, opis, lokalizacja, link do Google Calendar lub przejście do zadania StudyFlow).
  - Responsywny design na desktop, tablet i urządzenia mobilne.
- **Unifikacja wydarzeń i zadań StudyFlow:**
  - Zadania ze StudyFlow posiadające termin oddania (`dueDate`) są wizualizowane na osi czasu na podstawie oszacowanego czasu trwania (`estimatedMinutes`, domyślnie 60 minut przed terminem).
  - Kolorystyka: wydarzenia z Google Calendar wyróżnione są kolorem niebieskim (#4285F4), a zadania StudyFlow dziedziczą kolor przypisanego przedmiotu.
  - Filtry widoczności: niezależne włączanie/wyłączanie wydarzeń Google oraz zadań StudyFlow.
- **Bezpieczna integracja OAuth 2.0:**
  - Wykorzystanie oficjalnej biblioteki `googleapis`.
  - Zakres uprawnień ograniczony wyłącznie do odczytu: `https://www.googleapis.com/auth/calendar.events.readonly` oraz `calendar.readonly`.
  - Zabezpieczenie procesu autoryzacji tokenem CSRF (`state`) weryfikowanym w bezpiecznym ciasteczku `HttpOnly`.
  - Szyfrowanie tokenów OAuth (`access_token`, `refresh_token`) algorytmem **AES-256-GCM** przed zapisem w bazie PostgreSQL. Tokeny nigdy nie trafiają do przeglądarki klienta.
  - Automatyczne odświeżanie tokenów dostępu za pomocą `refresh_token`.
- **Silnik synchronizacji danych (`lib/google/syncService.ts`):**
  - Przycisk *„Synchronizuj teraz”* w ustawieniach i na ekranie kalendarza.
  - Leniwa synchronizacja w tle przy otwarciu kalendarza, gdy dane są starsze niż zdefiniowana częstotliwość.
  - Przyrostowa synchronizacja za pomocą `syncToken` — pobierane są tylko nowe, zmodyfikowane lub usunięte wydarzenia.
  - Automatyczna obsługa błędu Google API 410 (unieważniony `syncToken`) z bezpiecznym powrotem do pełnej synchronizacji.
  - Ochrona przed współbieżnością i blokada przed duplikowaniem wydarzeń na poziomie unikalnych indeksów bazy `[userId, googleEventId]`.
  - Endpoint cyklicznej synchronizacji serwerowej `/api/calendar/sync/cron` zabezpieczony kluczem `CRON_SECRET`.
- **Ustawienia Google Calendar (`/settings`):**
  - Połączenie i bezpieczne odłączenie konta Google (z wycofaniem tokenu w Google OAuth i kaskadowym usunięciem pobranych wydarzeń).
  - Wybór docelowego kalendarza Google z listy kalendarzy użytkownika.
  - Wybór częstotliwości synchronizacji (1, 3 lub 6 godzin).
  - Przełączniki widoczności wydarzeń Google i zadań StudyFlow zapisywane trwale w profilu studenta.
  - **Bezpośrednie wprowadzanie poświadczeń w interfejsie (`Client ID` i `Client Secret`):** użytkownik może wprowadzić dane aplikacji Google bezpośrednio w formularzu w `/settings` bez modyfikacji plików `.env` na serwerze; dane te są szyfrowane algorytmem **AES-256-GCM** i bezpiecznie przechowywane w bazie danych PostgreSQL.

---

## 3. Zestawienie Technologiczne

| Warstwa / Obszar | Wykorzystana technologia |
| :--- | :--- |
| **Framework Fullstack** | Next.js 14 (App Router) |
| **Język programowania** | TypeScript (tryb `strict`) |
| **Interfejs użytkownika** | Material UI (MUI v5), Emotion, Material Icons |
| **Integracja zewnętrzna** | Google Calendar API (`googleapis`) |
| **Kryptografia** | AES-256-GCM (Node.js `crypto`), `bcryptjs`, JWT (`jose`) |
| **Baza danych** | PostgreSQL |
| **ORM** | Prisma ORM |
| **Walidacja danych** | Zod |
| **Autoryzacja & Sesje** | JWT (`jose`), ciasteczka `HttpOnly`, `bcryptjs` |
| **Testy jednostkowe** | Vitest (56 testów obejmujących szyfrowanie, OAuth, bazodanowe klucze, synchronizację, domenę i dostęp) |

---

## 4. Konfiguracja Google Cloud Platform (Krok po kroku)

Aby włączyć synchronizację z Google Calendar w aplikacji StudyFlow:
1. Przejdź do [Google Cloud Console](https://console.cloud.google.com/) i utwórz nowy projekt (lub wybierz istniejący).
2. W sekcji **APIs & Services** $\rightarrow$ **Library** wyszukaj **Google Calendar API** i kliknij **Enable**.
3. Przejdź do **APIs & Services** $\rightarrow$ **OAuth consent screen**:
   - Wybierz typ: *External* (lub *Internal* w ramach Google Workspace).
   - Wypełnij nazwę aplikacji: *StudyFlow*, adres email wsparcia i kontakt programisty.
   - W sekcji **Scopes** dodaj:
     - `https://www.googleapis.com/auth/calendar.events.readonly`
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/userinfo.email`
   - W trybie testowym (*Testing*) dodaj swoje konto Google do listy **Test users**.
4. Przejdź do **APIs & Services** $\rightarrow$ **Credentials** $\rightarrow$ **Create Credentials** $\rightarrow$ **OAuth client ID**:
   - Application type: **Web application**.
   - Name: *StudyFlow Web Client*.
   - **Authorized redirect URIs**: dodaj adres:
     `http://localhost:3000/api/auth/google/callback`
     *(oraz dla domeny produkcyjnej, np. `https://twojadomena.pl/api/auth/google/callback`)*.
5. Skopiuj wygenerowane **Client ID** oraz **Client Secret** do pliku `.env`.


