# Справочники по Go

> Go reference sheets in Russian: language, runtime, standard library, HTTP, SQL, tooling, architecture.

Девять справочников по Go — от синтаксиса до сервиса в production. Материал собран из официальной документации и спецификации языка, примеры проверены на Go 1.27.

**Читать онлайн:** https://akosou94.github.io/go-reference/

> GitHub показывает `.html`-файлы как исходник. Чтобы читать справочники, открывайте GitHub Pages или локальный сервер — не файлы в интерфейсе репозитория.

## Что внутри

| Лист | О чём |
|---|---|
| [Язык](https://akosou94.github.io/go-reference/language.html) | пакеты и видимость, переменные и константы, zero values, типы и преобразования, строки и руны, срезы и мапы, структуры и embedding, интерфейсы, дженерики, ошибки, `defer`, циклы |
| [Параллелизм](https://akosou94.github.io/go-reference/concurrency.html) | горутины, каналы, `select`, `sync`, `context`, модель памяти, паттерны, тестирование |
| [Рантайм](https://akosou94.github.io/go-reference/runtime.html) | планировщик G-M-P, стеки, аллокатор, сборка мусора, `GOGC` и `GOMEMLIMIT`, escape analysis, `pprof` |
| [Стандартная библиотека](https://akosou94.github.io/go-reference/stdlib.html) | `strings`, `bytes`, `strconv`, `fmt`, `io`, `os`, `time`, `encoding/json`, `net/http`, `log/slog`, `slices`, `maps`, `embed` |
| [HTTP-сервис](https://akosou94.github.io/go-reference/http-service.html) | запрос от сокета до ответа, таймауты, `ServeMux`, middleware, лимиты тела, ошибки как контракт, graceful shutdown, клиент, тесты |
| [SQL и Postgres](https://akosou94.github.io/go-reference/sql.html) | `database/sql`, `pgx`, пул соединений, транзакции и изоляция, SQLSTATE, индексы, `EXPLAIN`, миграции |
| [Инструменты](https://akosou94.github.io/go-reference/tooling.html) | `go mod` и workspaces, тесты, fuzzing, бенчмарки, `vet`, `staticcheck`, `-race`, delve, сборка и кросс-компиляция |
| [Архитектура](https://akosou94.github.io/go-reference/architecture.html) | пакет как модуль, `internal` и `cmd`, интерфейсы на стороне потребителя, DI без фреймворка, слои, ошибки, конфигурация, тестовые швы |
| [Примеры кода](https://akosou94.github.io/go-reference/examples.html) | сервис заявок целиком в файлах: домен, сервис, Postgres с optimistic locking, HTTP, `main`, тесты, миграция |

Плюс [главная](https://akosou94.github.io/go-reference/) и [«Указатель»](https://akosou94.github.io/go-reference/ukazatel.html) — 614 сущностей из всех листов со ссылками на место описания.

В каждом листе: поиск по странице, липкое оглавление, палитра переходов `Cmd/Ctrl+E`, тёмная и светлая темы, копирование кода и горячие клавиши.

## Локально

```bash
git clone https://github.com/akosou94/go-reference.git
cd go-reference
python3 -m http.server 8000
```

Откройте http://localhost:8000. Без сервера страницы тоже работают, но локальный сервер ближе к тому, как их отдаёт GitHub Pages.

## Как это собрано

Статический HTML без сборщика и зависимостей: `assets/reference.css`, `assets/reference.js`, `assets/page.js`, `assets/quickopen.js`, `assets/backtotop.js`.

Общая обвязка и «Указатель» генерируются:

```bash
python3 tools/build-layout.py       # навигация, панель клавиш, подвал, теги скриптов
python3 tools/build-ukazatel.py language concurrency runtime
python3 tools/build-refindex.py     # индекс для палитры Cmd/Ctrl+E
```

`ukazatel.html` и `assets/refindex.js` — сгенерированные файлы, вручную их не правят. Повторный запуск генераторов идемпотентен.

## Версия и источники

Версия языка — **Go 1.27**. Отмечено, с какой версии появилось поведение: переменные цикла и `range` по целому — 1.22, `range` по функции — 1.23, generic type aliases — 1.24, `new(expr)` — 1.26, generic methods — 1.27.

Основные источники: [спецификация Go](https://go.dev/ref/spec), [Effective Go](https://go.dev/doc/effective_go), [GC guide](https://go.dev/doc/gc-guide), [Diagnostics](https://go.dev/doc/diagnostics), [Go Modules Reference](https://go.dev/ref/mod), [pkg.go.dev](https://pkg.go.dev/), [документация PostgreSQL](https://www.postgresql.org/docs/current/), release notes Go 1.20–1.27.

## Как помочь

Issues приветствуются: фактическая ошибка, опечатка, битая ссылка, пример, который не компилируется. Pull request — только после обсуждения в issue и только по одной теме. Подробности — в [CONTRIBUTING.md](CONTRIBUTING.md).

## Лицензия

Текст справочников — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), код инструментов — MIT. Полный текст — в [LICENSE](LICENSE).
