# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Tasks MCP

[English](./README.md) | **Русский**

[![npm](https://img.shields.io/npm/v/mcp-google-tasks)](https://www.npmjs.com/package/mcp-google-tasks)
[![CI](https://github.com/A1-x-Tech/mcp-google-tasks/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-tasks/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-tasks/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-tasks)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Tasks MCP** позволяет AI-приложению управлять Google Tasks на естественном языке. Можно спланировать проект как список задач, разбить работу на подзадачи со сроками и заметками, отмечать сделанное и поддерживать порядок.

Сервер работает с Google Tasks API через ваш Google-аккаунт. Он отделяет обратимое завершение от безвозвратного удаления и явно показывает ограничения Tasks API, а не создаёт впечатление, что планировщику доступно всё.

- **15 инструментов.** Просмотр, создание и изменение списков и задач, перемещение задач, управление завершением, массовая очистка сделанного и прямой вызов API, когда отдельного инструмента нет.
- **Завершение обратимо, удаление — нет.** У `complete_task` есть отмена (`reopen_task`); инструменты удаления отделены и помечены как разрушительные.
- **Честные сроки.** API хранит только календарную дату — сервер не изображает планирование по часам; время дня записывается в заметки.
- **Минимальный scope Google.** Единственный scope `tasks` — без доступа к Drive, Calendar и Gmail.

Начните с запроса, который только читает данные:

> Покажи мои списки задач и всё, что нужно сделать до пятницы в списке по умолчанию.

[Подключить сервер](#быстрый-старт) · [Посмотреть сценарии](#что-можно-поручить) · [Открыть техническую документацию](#техническая-документация)

---

## Увидеть работу за минуту

> **Вы:** Что ещё не сделано в списке «Запуск сайта» и какие сроки на этой неделе?
>
> **Ассистент:** Показывает открытые задачи со сроками, заметками и подзадачами. Ничего не меняется.
>
> **Вы:** Добавь задачу «Разослать анонс запуска» со сроком в пятницу как подзадачу «Маркетинга».
>
> **Ассистент:** Показывает целевой список, родительскую задачу и предлагаемую задачу, затем запрашивает подтверждение перед созданием.
>
> **Вы:** Подтверждаю.
>
> **Ассистент:** Создаёт подзадачу со сроком в пятницу. Он ничего не завершает и не удаляет, пока вы не попросите об этом отдельно.

## Содержание

- [Быстрый старт](#быстрый-старт)
- [Что можно поручить](#что-можно-поручить)
- [Как меняется задача](#как-меняется-задача)
- [Что может измениться](#что-может-измениться)
- [Как получить доступ](#как-получить-доступ)
- [Конфигурация](#конфигурация)
- [Данные, лимиты и работа в фоне](#данные-лимиты-и-работа-в-фоне)
- [Техническая документация](#техническая-документация)
- [Поддержка](#поддержка)

## Быстрый старт

Нужны Node.js 20+, Google-аккаунт и OAuth-данные из проекта Google Cloud с включённым Google Tasks API.

1. [Подготовьте Google OAuth-доступ](#как-получить-доступ).
2. Добавьте сервер в AI-приложение.
3. Отправьте запрос, который только читает данные.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**В приложении:** откройте **Settings → Plugins → MCP servers**, нажмите **Add server**, затем добавьте `npx -y mcp-google-tasks@latest` с `GOOGLE_TASKS_CLIENT_ID`, `GOOGLE_TASKS_CLIENT_SECRET` и `GOOGLE_TASKS_REFRESH_TOKEN`.

**В командной строке:**

```bash
codex mcp add google-tasks \
  --env GOOGLE_TASKS_CLIENT_ID=your_client_id \
  --env GOOGLE_TASKS_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_TASKS_REFRESH_TOKEN=your_refresh_token \
  -- npx -y mcp-google-tasks@latest
```

```bash
codex mcp list
```

[Документация Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

</details>

<details>
<summary><strong>Claude Code</strong></summary>

<br>

```bash
claude mcp add \
  --env GOOGLE_TASKS_CLIENT_ID=your_client_id \
  --env GOOGLE_TASKS_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_TASKS_REFRESH_TOKEN=your_refresh_token \
  --transport stdio --scope user google-tasks \
  -- npx -y mcp-google-tasks@latest
```

```bash
claude mcp list
```

[Документация Claude Code MCP](https://code.claude.com/docs/en/mcp)

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

<br>

Откройте **Settings → Developer → Edit Config** и добавьте:

```json
{
  "mcpServers": {
    "google-tasks": {
      "command": "npx",
      "args": ["-y", "mcp-google-tasks@latest"],
      "env": {
        "GOOGLE_TASKS_CLIENT_ID": "your_client_id",
        "GOOGLE_TASKS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_TASKS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

Если **Edit Config** недоступна, отредактируйте `~/Library/Application Support/Claude/claude_desktop_config.json` на macOS или `%APPDATA%\Claude\claude_desktop_config.json` на Windows.

[Документация Claude Desktop MCP](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)

</details>

<details>
<summary><strong>Cursor</strong></summary>

<br>

Добавьте в `~/.cursor/mcp.json` на macOS/Linux или `%USERPROFILE%\.cursor\mcp.json` на Windows:

```json
{
  "mcpServers": {
    "google-tasks": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-tasks@latest"],
      "env": {
        "GOOGLE_TASKS_CLIENT_ID": "your_client_id",
        "GOOGLE_TASKS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_TASKS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

[Документация Cursor MCP](https://cursor.com/docs/mcp)

</details>

<details>
<summary><strong>VS Code</strong></summary>

<br>

Запустите **MCP: Open User Configuration** и добавьте:

```json
{
  "servers": {
    "google-tasks": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-tasks@latest"],
      "env": {
        "GOOGLE_TASKS_CLIENT_ID": "${input:tasks_client_id}",
        "GOOGLE_TASKS_CLIENT_SECRET": "${input:tasks_client_secret}",
        "GOOGLE_TASKS_REFRESH_TOKEN": "${input:tasks_refresh_token}"
      }
    }
  },
  "inputs": [
    { "type": "promptString", "id": "tasks_client_id", "description": "Google OAuth client ID" },
    { "type": "promptString", "id": "tasks_client_secret", "description": "Google OAuth client secret", "password": true },
    { "type": "promptString", "id": "tasks_refresh_token", "description": "Google OAuth refresh token", "password": true }
  ]
}
```

Проверьте сервер командой **MCP: List Servers**.

[Документация VS Code MCP](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

</details>

## Что можно поручить

### Посмотреть списки и спланировать день

- Покажи мои списки задач и открытые задачи в каждом из них.
- Что нужно сделать на этой неделе в списке по умолчанию? Вместе с подзадачами.
- Что изменилось со вчерашнего дня? Включая завершённые и скрытые задачи.

### Создать и организовать работу

- Создай список «Запуск сайта» с задачами по дизайну, контенту и QA.
- Добавь задачу со сроком в пятницу и заметками — как подзадачу «Маркетинга».
- Перемести задачу в начало списка, под другую задачу или в другой список.

### Отслеживать завершение

- Отметь задачу по ревью сделанной — и переоткрой, если работа вернётся.
- Убери все завершённые задачи из списка одним действием.
- Покажи скрытые задачи, которые убрали раньше.

## Как меняется задача

1. Задачи живут в **списках задач**. У каждого аккаунта есть встроенный список по умолчанию со специальным id `@default`; `create_tasklist` добавляет новые.
2. У задачи есть название, заметки и срок — **только дата**: API отбрасывает время, поэтому время дня записывается в заметки.
3. Порядок и вложенность меняются только через `move_task` — поле `position` в API доступно только на чтение.
4. Завершение задачи обратимо: `reopen_task` возвращает её. Удаление задачи или списка безвозвратно, а удаление списка уносит все задачи в нём.

Повторяющиеся задачи через API создать нельзя. Задачи, назначенные из Google Docs или Chat, можно читать, но нельзя создавать и переносить в другой список, а удаление такой задачи убирает её и в исходном документе. Серверного поиска и сортировки нет — сервер выдаёт задачи списком, а фильтрует их AI-приложение.

## Что может измениться

| Операция | Что происходит | Граница подтверждения |
|---|---|---|
| Чтение списков и задач | Читает списки, задачи и их фильтры | Ничего не меняет |
| Создание списка или задачи | Добавляет список или открытую задачу | Меняет Google Tasks |
| Обновление задачи или переименование списка | Меняет название, заметки или срок | Меняет задачу |
| Перемещение задачи | Меняет порядок, вложенность или список | Меняет задачу |
| Завершение или переоткрытие задачи | Переключает статус завершения | Обратимое изменение |
| Очистка завершённых задач | Убирает все завершённые задачи списка из вида | Разрушительно |
| Удаление задачи или списка | Удаляет задачу — или список со всем содержимым | Разрушительно |
| Технический запрос API | Может вызвать метод API без отдельного инструмента | Потенциально разрушительно |

Как AI-приложение просит подтверждение, определяет само приложение. Сервер помечает операции чтения, записи и удаления, чтобы оно отличило проверку от рабочего изменения.

## Как получить доступ

Google Tasks требует OAuth 2.0: одного API-ключа недостаточно.

1. Создайте или выберите проект Google Cloud и включите **Google Tasks API**.
2. Настройте OAuth consent screen и создайте OAuth-клиент типа **Desktop app**.
3. Авторизуйте Google-аккаунт, которому принадлежат задачи. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) поможет получить refresh token, если включить **Use your own OAuth credentials**.
4. Запросите scope:

   ```text
   https://www.googleapis.com/auth/tasks
   ```

Refresh token OAuth-приложения в режиме Testing может истечь через семь дней. Для долгого доступа опубликуйте OAuth-приложение или используйте Internal-приложение в домене Workspace. Храните client secret и refresh token как пароли.

## Конфигурация

| Переменная | Обязательна | Описание |
|---|---|---|
| `GOOGLE_TASKS_CLIENT_ID` | Да* | OAuth client ID. |
| `GOOGLE_TASKS_CLIENT_SECRET` | Да* | OAuth client secret. |
| `GOOGLE_TASKS_REFRESH_TOKEN` | Да* | OAuth refresh token. |
| `GOOGLE_TASKS_ACCESS_TOKEN` | Да* | Короткоживущая альтернатива OAuth-тройке. |
| `GOOGLE_TASKS_API_BASE` | Нет | Переопределяет базовый URL Google Tasks API. |
| `GOOGLE_TASKS_TIMEOUT_MS` | Нет | Тайм-аут одного запроса; по умолчанию `60000` мс. |
| `GOOGLE_TASKS_MAX_RETRIES` | Нет | Повторы временных ошибок; по умолчанию `3`. |

\* Передайте OAuth-тройку или access token.

Без учётных данных сервер всё равно запускается и завершает MCP-рукопожатие; первый вызов инструмента вернёт ошибку, которая назовёт нужные переменные и попросит перезапуск.

## Данные, лимиты и работа в фоне

- **Запросы идут в Google Tasks.** Локальный сервер обновляет OAuth-токены Google и вызывает Tasks API. Анонимная телеметрия содержит ID установки, версию пакета, версии AI-клиента и платформы и имена инструментов — но не OAuth-токены, содержимое задач, аргументы или промпты. Чтобы отключить её, задайте `ASKADS_TELEMETRY=0`.
- **У Google есть дневная квота.** Лимит Tasks API — 50 000 запросов в день на проект. При `429` сервер использует задержку; чтение также повторяется после сетевых и `5xx` ошибок, а запись после неопределённой ошибки не повторяется — вместо этого проверьте результат через `get_task`.
- **Постоянного опроса нет.** Сервер работает только при вызове. `list_tasks` поддерживает инкрементальную синхронизацию через фильтр `updated_min`, поэтому AI-приложение с заданиями по расписанию может периодически проверять изменения, не перечитывая всё.

## Техническая документация

- [Каталог MCP-возможностей](./docs/capabilities/index.md) — страницы по пользовательским задачам для каждого инструмента.
- [Все инструменты и параметры](./docs/TOOLS.md)
- [Документация по разработке](./docs/DEVELOPMENT.md)
- [Документация по публикации](./docs/PUBLISHING.md)
- [Справочник Google Tasks API](https://developers.google.com/tasks)

## Поддержка

Нашли ошибку или не хватает сценария? [Создайте issue](https://github.com/A1-x-Tech/mcp-google-tasks/issues) или напишите в [Telegram](https://t.me/a1_mcp).

<br>

<p align="center">
  <img src="https://github.com/ztemerbekov/a1-yandex-kit-skills/raw/main/assets/images/mona-hifive-yandex-kit-warm.gif" alt="Две Моны дают пять" width="256">
</p>

<p align="center">
  Вы дочитали до конца!
</p>
