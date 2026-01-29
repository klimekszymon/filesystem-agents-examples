# Przykłady ze spotkania "Budowanie agentów AI w wirtualnym systemie plików"

Repozytorium zawiera przykłady omówione podczas spotkania [Budowanie agentów AI w wirtualnym systemie plików](https://www.youtube.com/watch?v=rntEm3kuodA&pp=2AaYA9IHCQmRCgGHKiGM7w%3D%3D) w ramach projektu [AI_devs 4: Builders](https://aidevs.pl/)

> UWAGA: Kod w katalogu `01_agent/tools/` pochodzi oryginalnie z poniższych serwerów MCP. Jednak na potrzeby ułatwienia procesu instalacji przykładów, postanowiłem przenieść logikę narzędzi do tego repozytorium.
> - **files** — [iceener/files-stdio-mcp-server](https://github.com/iceener/files-stdio-mcp-server)
> - **resend** — [iceener/resend-streamable-mcp-server](https://github.com/iceener/resend-streamable-mcp-server)
> - **firecrawl** — Firecrawl MCP (obecnie niepubliczny)

## Wymagania

- [**Node.js 24+**](https://nodejs.org/en)
- Klucze API: [OpenAI](https://platform.openai.com/api-keys), [Firecrawl](https://www.firecrawl.dev/app), [Resend](https://resend.com/api-keys)

## Instalacja

### 1. Instalacja zależności

```bash
cd 01_agent
npm install
```

### 2. Zmienne środowiskowe

Skopiuj plik `env.example` do `.env` i uzupełnij klucze API:

```bash
cp env.example .env
```

Zawartość `.env`:

```bash
# OpenAI API Key (wymagany)
OPENAI_API_KEY=sk-...

# Firecrawl API Key (wymagany do scrapowania)
FIRECRAWL_API_KEY=fc-...

# Resend API Key (wymagany do wysyłania maili)
RESEND_API_KEY=re_...

# Adres nadawcy (wymagany do wysyłania maili)
RESEND_DEFAULT_FROM=newsletter@twojadomena.com

# Whitelist odbiorców (opcjonalny, oddzielony przecinkami)
# Obsługuje dokładne adresy lub wzorce domen (@example.com)
# Jeśli nie ustawiony, wszyscy odbiorcy są dozwoleni!!!!
RESEND_ALLOWED_RECIPIENTS=test@example.com,@twojadomena.com

# Katalog wyjściowy Firecrawl (opcjonalny, domyślnie workspace/web)
FIRECRAWL_OUTPUT_DIR=/path/to/01_agent/workspace/web

# Tryb wyjściowy Firecrawl: "direct" lub "file" (opcjonalny, domyślnie "direct")
FIRECRAWL_OUTPUT_MODE=direct
```

### 3. Uruchom agenta

```bash
npm start
```

## Przykładowe zapytania

Po uruchomieniu agenta możesz zadawać mu polecenia w języku naturalnym:

**Scrapowanie strony i wyszukiwanie informacji:**
```
Scrape the contents of the overment.ai website and find the X handle within it.
```

**Wysyłanie pliku mailem:**
```
Send the contents of the general.md file to adam@overment.com and name it "Personality"
```

**Operacje na plikach:**
```
Pokaż mi zawartość katalogu workspace
Znajdź wszystkie pliki zawierające "TODO"
Utwórz nowy plik notes.md z listą zadań
```

## Dostępne narzędzia

Agent ma dostęp do **4 narzędzi**:

| Narzędzie | Opis |
|-----------|------|
| `fs_read` | Odczyt plików, listowanie katalogów, wyszukiwanie treści |
| `fs_write` | Tworzenie, edycja i usuwanie plików |
| `scrape` | Scrapowanie stron WWW (Firecrawl) |
| `send` | Wysyłanie maili (Resend) |

---

## 02_daytona — Agent z sandboxem Daytona

Drugi przykład demonstruje agenta wykorzystującego [Daytona](https://daytona.io) jako izolowane środowisko do wykonywania kodu. Agent może dynamicznie odkrywać umiejętności oraz pisać i wykonywać kod JavaScript.

### Instalacja

```bash
cd 02_daytona
npm install
cp env.example .env
```

Uzupełnij `.env`:

```bash
OPENAI_API_KEY=sk-...
DAYTONA_API_KEY=...
```

### Uruchomienie

```bash
npm start
```

### Przykładowe zapytanie

```
Summarize the order amounts
```