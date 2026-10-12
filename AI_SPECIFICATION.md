# AI_SPECIFICATION.md — StudyFlow

> **Cel dokumentu:** Jedno źródło prawdy dla agenta AI implementującego MVP aplikacji StudyFlow.  
> **Status:** Specyfikacja MVP. Elementy oznaczone **[ZAŁOŻENIE]** są decyzjami przyjętymi na potrzeby rozpoczęcia implementacji i można je zmienić świadomie, aktualizując ten dokument.

## 1. Cel i zakres projektu

StudyFlow to prosta aplikacja do organizowania zadań akademickich. Student tworzy przedmioty, przypisuje do nich zadania i opcjonalne kategorie, ustala termin oraz Story Points (skala 1–10), a następnie przegląda zadania na interaktywnej macierzy Eisenhowera.

Aplikacja ma działać w przeglądarce na komputerze i telefonie oraz dawać się zainstalować jako PWA. W MVP połączenie z internetem jest wymagane do korzystania z aplikacji; pełna praca offline i synchronizacja offline nie są wymagane.

### Cele MVP

- Szybkie dodawanie i edytowanie przedmiotów oraz zadań.
- Czytelny widok najbliższych terminów.
- Automatyczne rozmieszczanie zadań na macierzy Eisenhowera według progów wybranych przez użytkownika.
- Możliwość ręcznego nadpisania położenia zadania na macierzy.
- Bezpieczne konta indywidualnych użytkowników.
- Instalowalna, responsywna aplikacja PWA.

### Poza zakresem MVP

- Współdzielenie przedmiotów lub zadań między studentami.
- Zespoły, komentarze, czat i współpraca w czasie rzeczywistym.
- Pełna praca offline i synchronizacja zmian.
- Powiadomienia push, SMS i e-mail.
- Integracje z kalendarzami zewnętrznymi.
- Zaawansowane raporty, sztuczna inteligencja do planowania i śledzenie czasu pracy.
- Własne konfigurowalne statusy zadań.

## 2. Użytkownicy, role i dostęp

### Student

- Może zarejestrować konto za pomocą unikalnego loginu i hasła.
- Może się zalogować i wylogować.
- Może zarządzać wyłącznie swoimi przedmiotami, kategoriami, zadaniami i ustawieniami.
- Nie może odczytywać ani modyfikować danych innych użytkowników.

### Administrator

- Ma dostęp do odrębnego panelu administracyjnego.
- Może przeglądać podstawowe informacje o kontach i zarządzać kontami zgodnie z zakresem MVP.
- Nie powinien domyślnie przeglądać treści prywatnych zadań, jeśli nie jest to niezbędne do konkretnej funkcji administracyjnej.
- Dostęp administratora musi być kontrolowany po stronie serwera.

**Ważne bezpieczeństwo:** nie używaj na produkcji stałych danych `admin/admin`. Konto administratora należy utworzyć przez bezpieczny proces inicjalizacji lub skrypt z danymi pobieranymi ze zmiennych środowiskowych. Hasło musi być silne i zmienione po pierwszym użyciu, jeśli mechanizm inicjalizacji tego wymaga. Nie umieszczaj haseł ani sekretów w repozytorium.

**[ZAŁOŻENIE]** Login jest unikalną nazwą użytkownika, a nie adresem e-mail. Rejestracja wymaga loginu i hasła. Reset hasła przez e-mail nie jest wymagany w MVP, ponieważ nie określono obsługi adresów e-mail. Jeśli zostanie dodany, należy zaprojektować go jako osobną funkcję.

## 3. Technologia

Wymagany stos:

- **Next.js** z App Router.
- **TypeScript** w trybie `strict`.
- **React**.
- **Material UI (MUI)** jako podstawowa biblioteka komponentów interfejsu.
- **PWA** z Web App Manifest i Service Worker.
- **PostgreSQL** jako baza danych.
- **Prisma** jako ORM i narzędzie migracji.
- **Zod** do walidacji danych wejściowych.
- **Git** do kontroli wersji.

**[ZAŁOŻENIE]** Jako prosty wariant hostingu wybierz Vercel dla aplikacji i zarządzany PostgreSQL z bezpłatnym planem, np. Supabase lub Neon, o ile aktualne limity i warunki planu pasują do projektu. Nie zakładaj, że darmowy plan jest bezterminowy. Używaj tylko jednego dostawcy bazy w implementacji; nie twórz jednocześnie kilku konfiguracji.

**[ZAŁOŻENIE]** Do uwierzytelniania wybierz sprawdzoną bibliotekę zgodną z aktualną wersją Next.js i wymaganiem logowania loginem oraz hasłem. Zanim rozpoczniesz implementację, sprawdź aktualną dokumentację oraz zgodność biblioteki z wybranym sposobem przechowywania sesji. Nie implementuj własnego mechanizmu kryptograficznego.

Wersje bibliotek powinny być kompatybilne ze sobą i aktualnie wspierane. Nie aktualizuj głównych wersji zależności bez powodu.

## 4. Model danych

Zaprojektuj prosty model relacyjny. Nazwy są propozycją i mogą zostać dopasowane do konwencji ORM, ale semantyka musi zostać zachowana.

### User

- `id`
- `username` — unikalny
- `passwordHash` — wyłącznie hash hasła
- `role` — `STUDENT` albo `ADMIN`
- `createdAt`
- `updatedAt`

### Subject

- `id`
- `ownerId` — właściciel, relacja do `User`
- `name`
- `color` — opcjonalny kolor
- `description` — opcjonalny opis
- `createdAt`
- `updatedAt`

Nazwa przedmiotu jest wymagana. Przedmioty należą do jednego użytkownika.

### Category

- `id`
- `ownerId` — właściciel
- `subjectId` — przedmiot, do którego przypisana jest kategoria
- `name`
- `description` — opcjonalny opis
- `createdAt`
- `updatedAt`

Kategoria należy do konkretnego przedmiotu i jego właściciela. Kategoria może być przypisana do wielu zadań z tego samego przedmiotu. W MVP nie można przypisać zadania do kategorii z innego przedmiotu.

### Task

- `id`
- `ownerId` — właściciel
- `subjectId` — wymagany przedmiot
- `categoryId` — opcjonalna kategoria
- `title`
- `description` — opcjonalny opis
- `dueDate` — termin oddania
- `storyPoints` — liczba całkowita od 1 do 10
- `status` — `NEW`, `TODO`, `IN_PROGRESS`, `DONE`
- `priorityOverride` — opcjonalne ręczne nadpisanie ważności: `IMPORTANT` albo `NOT_IMPORTANT`
- `urgencyOverride` — opcjonalne ręczne nadpisanie pilności: `URGENT` albo `NOT_URGENT`
- `createdAt`
- `updatedAt`
- `completedAt` — opcjonalny czas ukończenia

Jeśli ręczne przesunięcie kropki ma zostać zachowane, zapisuj je jako jawne nadpisanie klasyfikacji. Nie zapisuj wyłącznie chwilowych współrzędnych ekranu.

### UserSettings

- `userId` — relacja jeden do jednego z użytkownikiem
- `importantStoryPointsThreshold` — próg ważności, od 1 do 10
- `urgentWithinDays` — próg pilności w dniach, liczba całkowita nieujemna
- `createdAt`
- `updatedAt`

**[ZAŁOŻENIE]** Początkowe wartości ustawień to próg ważności `6` oraz pilność w terminie `3` dni. Użytkownik może je zmienić w ustawieniach. Wartości domyślne nie mogą być na stałe wpisane w logikę macierzy.

### Reguły integralności

- Każdy rekord użytkownika musi być chroniony kontrolą właściciela po stronie serwera.
- `Task.subjectId` musi wskazywać przedmiot należący do tego samego `ownerId`.
- Jeśli `categoryId` jest ustawione, kategoria musi należeć do tego samego użytkownika i tego samego przedmiotu co zadanie.
- Usuwanie przedmiotu z zadaniami powinno wymagać potwierdzenia i jasno informować, że powiązane kategorie oraz zadania zostaną usunięte. **[ZAŁOŻENIE]** Przyjmij usuwanie kaskadowe po potwierdzeniu użytkownika.
- Nie dopuszczaj ujemnych Story Points, pustych tytułów ani nieprawidłowych terminów.
- Kwestię zmiany właściciela rekordu traktuj jako niedozwoloną operację.

## 5. Reguły macierzy Eisenhowera

Macierz jest głównym elementem dashboardu. Ma cztery ćwiartki:

1. Ważne i pilne.
2. Ważne i niepilne.
3. Nieważne i pilne.
4. Nieważne i niepilne.

Każde aktywne zadanie jest reprezentowane przez kropkę. Kliknięcie kropki otwiera szczegóły zadania lub formularz edycji. Kropki muszą być dostępne również na małym ekranie; jeśli wykres nie mieści się na telefonie, zastosuj czytelny układ responsywny lub alternatywną listę ćwiartek.

### 5.1. Ważność — próg Story Points

Użytkownik ustala `importantStoryPointsThreshold` w zakresie 1–10.

- Jeśli `storyPoints >= importantStoryPointsThreshold`, zadanie jest **ważne**.
- Jeśli `storyPoints < importantStoryPointsThreshold`, zadanie jest **nieważne**.

Próg jest konfigurowany przez użytkownika, a nie przez administratora globalnie.

### 5.2. Pilność — liczba dni do terminu

Użytkownik ustala `urgentWithinDays`, czyli liczbę dni, w ramach których zadanie uznaje się za pilne.

- Jeśli termin przypada dziś lub minął, zadanie jest **pilne**.
- Jeśli liczba pełnych dni kalendarzowych do terminu jest mniejsza lub równa `urgentWithinDays`, zadanie jest **pilne**.
- W pozostałych przypadkach zadanie jest **niepilne**.

**[ZAŁOŻENIE]** Termin jest przechowywany i interpretowany jako data kalendarzowa w lokalnej strefie użytkownika, a nie jako precyzyjny czas w ciągu dnia. W obliczeniach używaj spójnej funkcji i unikaj błędów wynikających ze zmiany strefy czasowej lub czasu letniego. Zadanie bez terminu nie jest pilne.

### 5.3. Ręczna korekta klasyfikacji

Użytkownik może ręcznie zmienić ważność i/lub pilność zadania z poziomu szczegółów zadania albo przez przeciągnięcie kropki do innej ćwiartki, jeśli drag-and-drop zostanie zaimplementowany.

- Nadpisanie ważności nie zmienia Story Points.
- Nadpisanie pilności nie zmienia terminu.
- Zmiana progu w ustawieniach ponownie oblicza klasyfikację automatyczną.
- **[ZAŁOŻENIE]** Istniejące ręczne nadpisania pozostają aktywne po zmianie progów, dopóki użytkownik nie wybierze „Przywróć automatyczne wyliczanie” dla danego wymiaru.
- Użytkownik może przywrócić automat niezależnie dla ważności i pilności.
- Interfejs powinien wizualnie odróżniać klasyfikację automatyczną od ręcznie nadpisanej.

Zaimplementuj jedną wspólną funkcję domenową do wyliczania klasyfikacji i używaj jej w macierzy, listach oraz szczegółach zadania.

### 5.4. Zadania ukończone

**[ZAŁOŻENIE]** Zadania ze statusem `DONE` nie są wyświetlane na domyślnej macierzy aktywnych zadań, ale pozostają dostępne na liście zadań po włączeniu filtra „Ukończone”. Ich danych nie usuwaj automatycznie.

## 6. Funkcjonalności MVP

### 6.1. Rejestracja, logowanie i wylogowanie

- Rejestracja loginem i hasłem.
- Walidacja loginu i hasła po stronie serwera.
- Unikalność loginu bez rozróżniania wielkości liter **[ZAŁOŻENIE]**.
- Bezpieczne hashowanie haseł za pomocą sprawdzonej biblioteki.
- Sesja przechowywana w bezpiecznym cookie `HttpOnly`, z odpowiednimi ustawieniami `Secure` w produkcji i `SameSite`.
- Ochrona stron i operacji wymagających zalogowania.
- Czytelne komunikaty błędów bez ujawniania wrażliwych informacji.
- Ograniczenie prób logowania lub inne zabezpieczenie przed nadużyciami, stosownie do hostingu.

### 6.2. Przedmioty

Użytkownik może:
- tworzyć przedmiot;
- wyświetlać listę swoich przedmiotów;
- edytować nazwę, kolor i opcjonalny opis;
- usuwać przedmiot po potwierdzeniu.

### 6.3. Kategorie

Użytkownik może:
- tworzyć kategorię w ramach wybranego przedmiotu;
- edytować i usuwać kategorię;
- przypisywać kategorię do zadania z tego samego przedmiotu;
- pozostawić zadanie bez kategorii.

Usunięcie kategorii nie powinno usuwać zadań. **[ZAŁOŻENIE]** Po usunięciu kategorii przypisane zadania zachowują się, ale ich `categoryId` jest ustawiane na `null`.

### 6.4. Zadania

Użytkownik może:
- tworzyć, wyświetlać, edytować i usuwać własne zadania;
- wskazywać przedmiot i opcjonalną kategorię;
- ustawiać tytuł, opis, termin, Story Points i status;
- oznaczać zadanie jako ukończone;
- filtrować zadania po przedmiocie, kategorii, statusie i terminie;
- sortować zadania według terminu i Story Points.

Tytuł, przedmiot, Story Points i termin są wymagane w MVP. **[ZAŁOŻENIE]** Jeżeli użytkownik chce zapisać zadanie bez terminu, dopuść `dueDate = null` i oznacz je jako „Bez terminu”; nie uznawaj go wtedy za pilne. To założenie ma pierwszeństwo przed ogólną listą wymaganych pól, aby użytkownik mógł szybko zapisać zadanie, dla którego termin nie został jeszcze podany.

Story Points to pojedyncza skala od 1 do 10, która w tym projekcie pełni też rolę wskaźnika ważności. Nie wprowadzaj drugiego pola „waga”.

Statusy:
- `NEW` — Nowe
- `TODO` — Do zrobienia
- `IN_PROGRESS` — W trakcie
- `DONE` — Ukończone

### 6.5. Dashboard

Po zalogowaniu student trafia na dashboard zawierający:
- macierz Eisenhowera;
- liczbę aktywnych zadań;
- liczbę zadań z terminem dzisiaj lub po terminie;
- najbliższe terminy;
- szybki przycisk „Dodaj zadanie”;
- możliwość przejścia do zarządzania przedmiotami.

Nie przeładowuj dashboardu zbędnymi wykresami ani statystykami.

### 6.6. Powiadomienia w aplikacji

W MVP powiadomienia są widoczne wewnątrz aplikacji, np. w panelu lub menu z ikoną dzwonka. Nie implementuj push, e-mail ani SMS.

**[ZAŁOŻENIE]** Generuj co najmniej informacyjne przypomnienia o zadaniach z terminem dziś lub po terminie. Powiadomienia mogą być wyliczane na podstawie aktualnych danych przy otwarciu aplikacji, zamiast wymagać osobnego systemu kolejkowego. Jeśli użytkownik oznaczy zadanie jako ukończone, nie pokazuj go jako aktywnego przypomnienia.

## 7. UI/UX i nawigacja

Użyj MUI i spójnego systemu komponentów. Interfejs ma być prosty, czytelny i mobile-first.

### Główne widoki

- `/login` — logowanie.
- `/register` — rejestracja.
- `/dashboard` — główny dashboard z macierzą.
- `/tasks` — lista zadań i filtry.
- `/tasks/new` — tworzenie zadania albo równoważny dialog.
- `/tasks/[id]` — szczegóły/edycja zadania albo równoważny dialog.
- `/subjects` — lista przedmiotów.
- `/subjects/[id]` — przedmiot, jego kategorie i zadania.
- `/settings` — progi macierzy i podstawowe ustawienia konta.
- `/admin` — panel administratora dostępny tylko dla roli `ADMIN`.

Można użyć dialogów lub drawerów zamiast osobnych stron, jeśli zapewni to prostszy i spójny UX. Nie twórz niepotrzebnych tras.

### Responsywność

- Na komputerze macierz powinna zajmować centralną część dashboardu.
- Na telefonie priorytetem są czytelne zadania, wygodne przyciski i formularze.
- Zapewnij alternatywę dla precyzyjnego przeciągania kropki: użytkownik musi móc zmienić klasyfikację w formularzu.
- Wszystkie ważne akcje muszą działać dotykiem i klawiaturą.
- Uwzględnij stany ładowania, brak danych, błędy i potwierdzenia usuwania.
- Nie polegaj wyłącznie na kolorze do przekazywania statusu lub klasyfikacji.

## 8. PWA

Aplikacja musi być instalowalna jako PWA na obsługiwanych przeglądarkach i urządzeniach.

Wymagania:
- manifest zawierający `name`, `short_name`, `start_url`, `display`, `theme_color`, `background_color` i odpowiednie ikony;
- prawidłowe ikony dla wymaganych rozmiarów;
- Service Worker skonfigurowany przy użyciu rozwiązania zgodnego z aktualnym Next.js;
- działanie instalacji i uruchamiania z ekranu głównego;
- HTTPS na produkcji;
- poprawna obsługa aktualizacji aplikacji.

Internet jest wymagany do logowania, pobierania danych i wykonywania operacji. Nie implementuj pełnego trybu offline, lokalnej kolejki zmian ani synchronizacji po odzyskaniu połączenia. Nie cache'uj prywatnych odpowiedzi API ani danych użytkownika w sposób, który mógłby ujawnić je po wylogowaniu lub na współdzielonym urządzeniu. Można cache'ować bezpieczne zasoby statyczne zgodnie z dobrze przemyślaną strategią.

## 9. Bezpieczeństwo

- Autoryzacja i kontrola właściciela muszą być egzekwowane na serwerze, nie tylko w interfejsie.
- Nie ufaj identyfikatorom właściciela przesyłanym przez klienta; wyznaczaj właściciela na podstawie sesji.
- Waliduj dane wejściowe na serwerze, np. przez Zod.
- Nie ujawniaj hashy haseł, sekretów ani szczegółów wewnętrznych błędów.
- Stosuj parametryzowane zapytania/ORM.
- Ogranicz dostęp do panelu administratora po stronie serwera.
- Nie pozwól użytkownikowi zmienić własnej roli przez zwykły endpoint lub formularz.
- Przechowuj sekrety w zmiennych środowiskowych.
- Użyj bezpiecznych cookies i ochrony przed typowymi atakami webowymi zgodnie z dokumentacją wybranej biblioteki uwierzytelniania.
- Nie loguj haseł, tokenów sesji ani pełnych prywatnych danych zadań bez potrzeby.

## 10. Architektura i organizacja kodu

Trzymaj frontend i backend w jednym projekcie Next.js. Stosuj Server Components domyślnie, a Client Components tylko wtedy, gdy wymagane są interakcje przeglądarkowe.

Proponowany podział:
- `app/` — trasy, layouty i elementy aplikacji Next.js;
- `components/` — współdzielone komponenty UI;
- `features/` — logika i komponenty zadań, przedmiotów, kategorii, macierzy i ustawień;
- `lib/` — konfiguracja, sesja, walidacja i pomocnicze funkcje;
- `lib/domain/` — reguły domenowe, w tym klasyfikacja Eisenhowera;
- `prisma/` — schemat i migracje bazy danych;
- `public/` — ikony i zasoby statyczne PWA;
- `tests/` — testy.

To propozycja, a nie wymóg tworzenia wielu warstw. Dla małej funkcji używaj prostego rozwiązania, ale nie mieszaj kontroli dostępu, logiki biznesowej i renderowania UI w jednym dużym komponencie.

## 11. Testy i kryteria akceptacji

Dodaj testy dla reguł, które mogą powodować błędne klasyfikacje lub naruszenia prywatności.

### Testy logiki macierzy

- Story Points równe progowi oznaczają zadanie jako ważne.
- Story Points poniżej progu oznaczają zadanie jako nieważne.
- Termin dzisiejszy oznacza pilność.
- Termin przeszły oznacza pilność.
- Termin w granicy `urgentWithinDays` oznacza pilność.
- Termin poza granicą nie oznacza pilności.
- Brak terminu oznacza niepilność.
- Ręczne nadpisanie jednego wymiaru nie zmienia drugiego.
- Przywrócenie automatu ponownie wylicza dany wymiar.
- Ukończone zadania nie pojawiają się na domyślnej macierzy.

### Testy dostępu

- Użytkownik A nie może odczytać, zmienić ani usunąć danych użytkownika B, nawet znając identyfikator rekordu.
- Student nie może wejść do panelu administratora.
- Użytkownik nie może przypisać zadania do przedmiotu lub kategorii innego użytkownika.
- Niezalogowany użytkownik nie może korzystać z chronionych tras ani operacji.

### Definition of Done

Funkcjonalność jest ukończona, gdy:
- spełnia wymagania i kryteria akceptacji;
- działa na komputerze i telefonie;
- ma walidację oraz obsługę typowych błędów;
- odpowiednie testy przechodzą;
- TypeScript, lint i produkcyjny build przechodzą bez błędów;
- nie narusza prywatności danych;
- dokumentacja została zaktualizowana, jeśli zmieniły się istotne założenia.

Nie deklaruj przejścia testów, jeśli nie zostały faktycznie uruchomione.

## 12. Uruchomienie i wdrożenie

Projekt powinien zawierać:
- `README.md` z instrukcjami uruchomienia;
- `.env.example` bez prawdziwych sekretów;
- komendy instalacji, uruchomienia deweloperskiego, lintowania, sprawdzania typów, testów i produkcyjnego builda;
- migracje bazy danych;
- instrukcję bezpiecznego utworzenia administratora;
- instrukcję wdrożenia aplikacji i konfiguracji bazy danych.

Przed wdrożeniem produkcyjnym:
1. skonfiguruj zmienne środowiskowe;
2. uruchom migracje w kontrolowany sposób;
3. sprawdź rejestrację, logowanie i uprawnienia;
4. sprawdź działanie PWA przez HTTPS;
5. sprawdź, czy prywatne dane nie są współdzielone w cache;
6. skonfiguruj kopie zapasowe bazy odpowiednio do możliwości hostingu.

## 13. Zasady pracy agenta AI

1. Przed zmianami sprawdź istniejący kod i dokumentację.
2. Zrealizuj MVP etapami: konfiguracja projektu, baza danych, uwierzytelnianie, przedmioty i kategorie, zadania, macierz, ustawienia, PWA, testy i wdrożenie.
3. Nie twórz wszystkich funkcji w jednym niekontrolowanym kroku.
4. Nie dodawaj funkcji spoza zakresu bez uzasadnienia.
5. Nie dodawaj zależności bez potrzeby.
6. Nie zastępuj działających rozwiązań bez powodu.
7. Jeśli wymagania są niejednoznaczne, użyj jawnie oznaczonych założeń z tego dokumentu; nie komplikuj MVP.
8. Po każdym etapie uruchom odpowiednie testy, sprawdzanie typów i lint.
9. Zgłaszaj błędy, niespełnione testy i decyzje wymagające uwagi.
10. Nie umieszczaj prawdziwych sekretów w kodzie ani dokumentacji.
11. Aktualizuj dokument, jeśli zatwierdzona decyzja zmienia zachowanie aplikacji.
12. Na końcu podaj krótkie podsumowanie zmian, wyniki kontroli i instrukcję uruchomienia.

## 14. Podsumowanie zakresu MVP

MVP StudyFlow obejmuje:
- rejestrację, logowanie i wylogowanie loginem i hasłem;
- role student/admin i bezpieczny panel administratora;
- prywatne przedmioty, kategorie i zadania;
- Story Points 1–10;
- cztery statusy zadań;
- ustawiane przez użytkownika progi ważności i pilności;
- automatyczną macierz Eisenhowera z możliwością ręcznego nadpisania klasyfikacji;
- dashboard, listę zadań i powiadomienia wewnątrz aplikacji;
- responsywny interfejs MUI;
- instalowalne PWA wymagające internetu.

Każda funkcja niewymieniona w tym dokumencie jest poza zakresem MVP, dopóki nie zostanie świadomie dodana.
