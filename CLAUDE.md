# Personal OS — контекст проекта (читать в начале каждой сессии)

## Что это
Персональная модульная система продуктивности (life-OS): один дашборд + 11 модулей. Тёмная премиум-тема, минимализм. Мультипользовательский SaaS с изоляцией данных.

## Стек
- Next.js 15 (App Router) + React 18, деплой на Netlify (авто-деплой при push в main).
- Supabase: Postgres + Auth. Анонимный клиент — lib/supabase.js (браузер, под сессией пользователя). Service role — lib/supabaseAdmin.js (ТОЛЬКО сервер, обходит RLS).
- Rich-text (Дневник) — Tiptap.
- Репозиторий: github.com/caeskiras/personalos (ветка main). Supabase project: xrghigpvhrrhokmksxrc.

## Аутентификация и идентичность
- AUTH_ENABLED = true (lib/config.js). Вход: email+пароль + восстановление пароля (/auth, /auth/forgot, /auth/reset). Google OAuth НЕ подключён (точка расширения оставлена).
- getUserId() возвращает auth.uid() текущей сессии. Приложение закрыто за входом (AuthProvider + редирект на /auth).
- lib/store.js (useOS) — userId/userName из сессии Supabase.

## RLS — ВАЖНО
- RLS ВКЛЮЧЁН на всех таблицах с данными пользователя. Любая НОВАЯ таблица обязана иметь:
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  + ENABLE ROW LEVEL SECURITY + 4 политики (own_select/insert/update/delete) с условием auth.uid() = user_id.
- Делать политики идемпотентно (DROP POLICY IF EXISTS перед CREATE).

## Модель данных (свериться с БД!)
Все таблицы пользователя имеют user_id uuid + RLS. Основные:
- tasks (title, status todo/in_progress/done, priority, due_date, description, completed_at, tags[], project_id, recurrence)
- subtasks (task_id→tasks, title, is_done, position)
- projects (name, color, icon, description, status active/completed/archived, deadline; tasks.project_id связывает их)
- habits, habit_completions (habit_id+date уникальны)
- workouts (type_id→workout_types, duration, calories, notes, date, exercises jsonb), workout_types
- food_entries (date, time, name, calories, protein, carbs, fat, meal_type), food_favorites
- sleep_entries (date, bedtime, wake_time, duration_minutes, quality 1-5, notes)
- transactions (type income/expense, amount, category_id uuid, note, date, import_hash), finance_categories, finance_budgets
- journal_entries (title, content[HTML], mood, tags[jsonb], date), journal_tags
- focus_sessions (date, type focus/break/long_break, duration_minutes, task_id, project_id, completed)
- goals (progress_type percent/numeric/milestones, progress, current_value, target_value, unit, status active/completed/archived, deadline, color, icon, linked_project_ids jsonb, linked_task_ids jsonb, linked_habit_ids jsonb)
- goal_milestones (goal_id→goals, title, done, position), goal_categories
- user_profiles (calorie_goal, protein_goal, carbs_goal, fat_goal, sleep_goal_minutes, focus_goal_minutes, focus_work_minutes, focus_break_minutes, focus_long_break_minutes, focus_cycles_before_long, workout_weekly_goal, onboarding_completed, display_name, gender [male|female|other], birth_date [text YYYY-MM-DD], height_cm, weight_kg, activity_level [low|medium|high], theme [dark|light|system DEFAULT 'system']) — миграции 0017, 0019
- user_modules (module_id text, is_active, position int — порядок модулей в сайдбаре)
- auth.users (Supabase Auth)

## Темизация (ВАЖНО — не хардкодить цвета!)
- Тема применяется через `data-theme="dark|light"` на `<html>`. 3 режима: dark/light/system. Переключатель: Settings + ProfilePanel. Выбор хранится в localStorage (основной, предотвращает FOUC) + `user_profiles.theme` (кросс-девайс, миграция 0019).
- Анти-FOUC: инлайн-скрипт в app/layout.js читает localStorage ДО гидрации и выставляет data-theme.
- Все цвета — через CSS-переменные (`--color-*`) или Tailwind-токены, **NO хардкода серых hex**.
- RGB-токены (поддержка opacity-модификаторов): `bg`, `surface`, `muted`, `subtle`, `text`, `border` → `rgb(var(--xxx-rgb) / <alpha>)`. Пример: `bg-muted/30` работает.
- Простые hex-токены: `card`, `panel`, `bg-2`, `surface-2`, `surface-3`, `border-1`, `border-2`, `border-hover`, `text-2`…`text-9` → `var(--color-*)`.
- Акцентные цвета (accent, success, warning, danger) — фиксированные hex, не меняются между темами.
- Правило: НЕ использовать `bg-[#xxx]`, `text-[#xxx]`, `border-[#xxx]` для серых/нейтральных. Всегда токен.
- ThemeProvider: `app/components/ThemeProvider.jsx` + `lib/theme.js` (useTheme hook). Используй `useTheme()` для чтения/смены темы.

## Соглашения и общие паттерны (переиспользовать!)
- Оптимистичные обновления + состояния loading(skeleton)/empty/error везде.
- НАШ кастомный DatePicker во всех местах выбора даты (никаких нативных пикеров). ru, неделя с Пн. Путь: app/components/modules/DatePicker.jsx.
- НАШ кастомный Select (app/components/Select.jsx) во всех выпадающих списках — никаких нативных <select>. Поддерживает compact-режим для фильтр-баров, portal-дропдаун (фиксированное позиционирование, не клипается overflow), клавиатурную навигацию (стрелки/Enter/Esc), aria, тёмную и светлую темы через CSS-токены. Принимает options [{value,label}] или [{v,l}]; placeholder+placeholderValue для «пустого» состояния.
- Поповер дня на Главной (app/components/DayPopover.jsx): клик по ячейке дня в CalendarWidget открывает компактный попап с полной инфой за день, сгруппированной по модулям (задачи/привычки/тренировки/питание/сон/финансы/дедлайны целей). Умное позиционирование (portal, fixed), bottom-sheet на мобайлах, закрытие по клику-вне/Esc. Дополнительные данные (food/sleep/transactions/goals) грузятся лениво при первом клике на день (extraLoadedRef). CompactMonthCalendar передаёт (date, DOMRect) в onDayClick.
- Общий компонент месячного календаря: app/components/MonthCalendar.jsx. Экспортирует: shared константы (MONTHS, MONTHS_G, WEEKDAYS, WEEKDAYS_F), хелперы (localStr, getWeekStart, getWeekDays, getMonthCells); default export — CompactMonthCalendar (точки-индикаторы, для HomeScreen виджета). CalendarModule импортирует оттуда константы/хелперы, но использует свой MonthView с EventChip-пилюлями.
- Числовые инпуты — общий стиль без нативных стрелок-спиннеров (globals.css).
- Хитмэпы — единый компонент в стиле Привычек.
- Эмодзи+цвет пикеры — общий стиль.
- Списки записей сортируются по реальной дате: новые сверху, старые снизу.
- Даты хранить/трактовать в локальном времени (без UTC-сдвига). Хелпер: localStr(d) → "YYYY-MM-DD".
- Цвет каждого модуля — единый источник в lib/modules.js (используется в сайдбаре, на Главной, в Модулях, Аналитике, цветных иконках, слоях календаря).
- Глобальный Календарь: слои-источники через calendar-selectors + тогглы по модулям (Задачи/Привычки/Тренировки/Питание/Сон/Финансы). Не ломать существующие слои при добавлении новых.
- Селекторы агрегаций — в lib/<module>-selectors.js; доступ к БД — в lib/db/<entity>.js.
- RLS-safe reorder: individual UPDATE на каждую строку (не upsert), Promise.all.
- Toast: fixed top-4 right-4 z-50, AlertCircle, auto-dismiss 3s.
- Skeleton: [1,2,3].map(i => <div key={i} className="h-20 bg-[#1d1d1d] border border-[#333] rounded-xl animate-pulse"/>).
- Аналитика (/analytics): все данные грузятся один раз в AnalyticsScreen (Promise.all + safe-wrapper на каждый запрос). Переключатель периода Неделя/Месяц/Всё время — только перефильтрует уже загруженные данные (без повторных запросов). Бакеты для графиков: неделя → 7 дней, месяц → недели, всё время → 12 месяцев. MiniBarChart — CSS flex + height %, без сторонних библиотек. Ошибка одного виджета не роняет страницу (loadErr per domain). «Дней в системе» считается через supabase.auth.getUser() → user.created_at → локальная дата, (today - created) / 86400000 + 1 (включительно).
- Главная (/home) — дашборд-сводка дня. Адаптивная сетка (grid-cols-1 sm:2 lg:4, gridAutoFlow dense, gridAutoRows 160px). WIDGET_MAP покрывает ВСЕ 11 модулей: tasks, habits, focus, nutrition, sleep, finance, goals, fitness, journal, projects, calendar. Все обычные виджеты: единый размер 1×1 (160px). CalendarWidget: 2 cols × 2 rows (sm:col-span-2 row-span-2) — настоящая сетка месяца (CompactMonthCalendar) с точками-событиями, навигация по месяцам, данные из tasks+habits+workouts. При выключенных модулях пустот нет (dense flow). WidgetCard: h-full + min-h-0 overflow-hidden на content-зоне → фиксированная высота без распирания. Ошибка одного виджета не роняет страницу. Быстрые действия (check task/habit) используют e.stopPropagation().
- Сайдбар: навигационные пункты (Главная/Модули/Аналитика/Настройки) оформлены в едином стиле с модульными иконками — Lucide React иконки (Home, LayoutGrid, BarChart3, Settings), у каждого свой акцентный цвет (как у модулей), активное состояние: icon-bg + text цвет через style={}. Определены в OSLayout.jsx в NAV_ITEMS[].
- Профиль пользователя: клик на user-footer сайдбара → ProfilePanel (fixed bottom-left drawer). Поля: display_name, gender, birth_date + авто-возраст, height_cm, weight_kg, activity_level. Сохраняется через profileRepo.upsert. Задел для авто-нормы калорий (Питание).
- Страница /modules: адаптивная сетка карточек (grid-cols-1 sm:2 lg:3 xl:4). Два раздела — «Мои модули» (активные, draggable) + каталог по категориям. Drag-and-drop через dragHappened ref (сброс через setTimeout 200ms) — не ломает клики после дропа. Карточки одинаковой высоты через min-h + flex flex-col + mt-auto для кнопок.

## Заглушки «Функция в разработке» (каркас заложен, без реальной логики)
- Питание: «Посчитать по фото».
- Тренировки и Сон: «Подключить к часам».
- Финансы: «Импортировать выписку» (на будущее — анти-дубль через import_hash + авто-категоризация).
Клик по такой кнопке показывает «Функция в разработке».

## Миграции
- Последовательные пронумерованные файлы (на данный момент до 0016). Идемпотентность: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / DROP POLICY IF EXISTS.
- Новый модуль = новая миграция + lib/db + lib/selectors + компонент + регистрация модуля + (опц.) слой календаря.

## Деплой / окружение
- Деплой на Railway: Deploy from GitHub repo, ветка main, авто-деплой по push.
- Build: `npm run build`. Start: `next start -p $PORT` — Railway передаёт порт через $PORT, порт не хардкодить.
- ENV (в Railway): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
- Node: >=20 (зафиксировано в .nvmrc и engines в package.json).
- supabaseAdmin инициализировать лениво, чтобы билд не падал без env.

## Грабли (известные)
- После drag&drop в сайдбаре сбрасывать драг-состояние, иначе навигация виснет до ре-рендера. Порядок модулей персистить в user_modules.position.
- Не отправлять не-uuid в *_id колонки (иначе 22P02). Если значения нет — слать null.
- Новые таблицы без RLS-политик = пустые ответы под анонимной сессией. Всегда добавлять политики.

## Рабочий протокол
- Одно логическое изменение = один коммит = один push. Точечные правки, не переписывать всё.
- После изменений прогонять npm run build и проверять, что не сломаны другие модули.
- Отчёт: что сделано, статус сборки, как проверить.

## Поддержка этого файла (ОБЯЗАТЕЛЬНО)
CLAUDE.md — живой источник правды. В рамках ЛЮБОЙ задачи, которая меняет проект, ты ОБЯЗАН в том же коммите обновить соответствующие разделы CLAUDE.md. Это часть Definition of Done, а не отдельный шаг.
Обновлять, когда меняется:
- Модель данных: новая/изменённая таблица, колонка, связь, RLS-политика, номер миграции → обновить «Модель данных», «RLS», «Миграции».
- Новый модуль или фича → добавить в перечень модулей и, при необходимости, в «Паттерны»/«Заглушки»/«Слои календаря».
- Соглашения/паттерны (DatePicker, хитмэп, сортировка, цвета модулей, стили инпутов и т.п.) → раздел «Соглашения и общие паттерны».
- Деплой/окружение (ENV, build, версии, netlify) → раздел «Деплой / окружение».
- Найден баг-грабли или его фикс → раздел «Грабли».
Правила:
- Держать файл кратким и актуальным: устаревшее удалять, не накапливать историю.
- Если изменение НЕ влияет на архитектуру/данные/протокол — файл можно не трогать.
- В отчёте по задаче явно указывать: «CLAUDE.md обновлён: <разделы>» либо «CLAUDE.md без изменений».
