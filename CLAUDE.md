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
- booking_links (user_id, slug unique, title, duration_minutes, buffer_minutes, timezone, is_active) — миграция 0021
- availability_rules (link_id→booking_links, weekday 0-6, start_time, end_time) — per-day windows, RLS через link owner; миграция 0021
- meetings (user_id, link_id nullable, guest_name, guest_phone, guest_telegram, start_at timestamptz, end_at timestamptz, status confirmed/cancelled; exclusion constraint btree_gist no overlap) — миграция 0021
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
- Три состояния данных (не путать): 1) Загрузка → скелетоны/спиннер; 2) Данных нет → EmptyState с CTA; 3) Нет результатов поиска/фильтра → EmptyState без CTA на создание + «Сбросить фильтры».
- Единый EmptyState (app/components/EmptyState.jsx): props — modId (авто-иконка+цвет из MODULE_ICONS), icon, iconColor, title, description, actionLabel, onAction, compact. Используется во всех 10 модулях (tasks/habits/fitness/focus/goals/projects/journal/nutrition/sleep/finance). Compact-вариант — уменьшенные отступы/иконка для виджетов и истории сессий. ChartEmpty в AnalyticsScreen — отдельный inline-вариант внутри фиксированного h-[256px] (не импортирует shared EmptyState, чтобы не сломать layout карточки).
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
- Иконки модулей — единый источник lib/moduleIcons.js (MODULE_ICONS[modId] → { Icon, color }). Использовать везде: шапки всех 11 модулей (w-10 h-10 rounded-xl, bg = color+'20'), онбординг «Выберите модули», GenericModule. Не использовать emoji-иконки или другие Icon-компоненты вместо MODULE_ICONS.
- Глобальный Календарь: слои-источники через calendar-selectors + тогглы по модулям (Задачи/Привычки/Тренировки/Питание/Сон/Финансы/Встречи). Не ломать существующие слои при добавлении новых. CalendarModule имеет 3 таба: Календарь / Встречи / Ссылка записи. Публичная страница самозаписи — /book/[slug] (без авторизации, API-роут /api/book/[slug]). Слот-генерация — lib/booking/slots.js. Repo-слой: lib/db/bookingLinks.js, lib/db/availability.js, lib/db/meetings.js. Антидублирование встреч — btree_gist exclusion constraint + server-side re-validation (409 при гонке). Удаление booking_link: availability_rules каскадно удаляются (ON DELETE CASCADE), meetings.link_id → NULL (ON DELETE SET NULL) — гостевые брони сохраняются. После удаления UI сбрасывается в «нет ссылки», владелец создаёт новую с новым slug.
- Селекторы агрегаций — в lib/<module>-selectors.js; доступ к БД — в lib/db/<entity>.js.
- RLS-safe reorder: individual UPDATE на каждую строку (не upsert), Promise.all.
- Toast: fixed top-4 right-4 z-50, AlertCircle, auto-dismiss 3s.
- Skeleton: [1,2,3].map(i => <div key={i} className="h-20 bg-[#1d1d1d] border border-[#333] rounded-xl animate-pulse"/>).
- Аналитика (/analytics): все данные грузятся один раз в AnalyticsScreen (Promise.all + safe-wrapper на каждый запрос). Переключатель периода Неделя/Месяц/Всё время — только перефильтрует уже загруженные данные (без повторных запросов). Бакеты (временные ряды): неделя → 7 ежедневных точек (метки Пн…Вс), месяц → ежедневно (~30 точек, метка = число месяца), всё время → 12 месяцев. XAxis interval авто-прореживается до ~6 меток при > 10 точках. Вырожденные случаи: 0 точек с данными → ChartEmpty внутри фиксированной области; 1–2 точки → dot-маркер на AreaChart, одиночный bar на BarChart (не сплошной блок). Ошибка одного виджета не роняет страницу (loadErr per domain). «Дней в системе» считается через supabase.auth.getUser() → user.created_at → локальная дата, (today - created) / 86400000 + 1 (включительно). Сетка: grid-cols-1 sm:2 lg:3 + gridAutoFlow dense. Карточки (AnalyticsCard) — ФИКСИРОВАННАЯ высота h-[256px] (CARD_H), flex flex-col: заголовок (иконка + title + inline stats) shrink-0, chart area flex-1 min-h-0. Содержимое не растягивает карточку. Адаптивность по включённым модулям: ANALYTICS_MODULES (8 модулей). Графики: библиотека recharts (ResponsiveContainer). Типы: BarChart — Задачи (выполнено/день), Тренировки (кол-во/день), Цели (прогресс % по каждой цели); AreaChart — Привычки (avg completion % по бакетам), Фокус (минуты), Питание (ср. ккал/день), Сон (ср. длит.); ComposedChart+Area — Финансы (доходы+расходы). Цвета — MODULE_ICONS[modId].color + градиентная заливка. Пустое состояние / ошибка — внутри той же h-[256px], не меняет габариты.
- Главная (/home) — дашборд-сводка дня. Адаптивная сетка (grid-cols-1 sm:2 lg:4, gridAutoFlow dense, gridAutoRows 160px). WIDGET_MAP покрывает ВСЕ 11 модулей: tasks, habits, focus, nutrition, sleep, finance, goals, fitness, journal, projects, calendar. Все обычные виджеты: единый размер 1×1 (160px). CalendarWidget: 2 cols × 2 rows (sm:col-span-2 row-span-2) — настоящая сетка месяца (CompactMonthCalendar) с точками-событиями, навигация по месяцам, данные из tasks+habits+workouts. При выключенных модулях пустот нет (dense flow). WidgetCard: h-full + min-h-0 overflow-hidden на content-зоне → фиксированная высота без распирания. Ошибка одного виджета не роняет страницу. Быстрые действия (check task/habit) используют e.stopPropagation().
- Адаптивная оболочка (OSLayout.jsx): десктоп (md+) — двухколоночный layout: sidebar w-56 (всегда виден, `hidden md:flex`) + main flex-1. Мобила (< md) — sidebar скрыт, показывается топбар h-14 (`flex md:hidden`) с гамбургером (Menu icon) и логотипом; по тапу на гамбургер выезжает drawer (fixed, w-64, slide-in transform) с backdrop (black/50 с blur); тап по backdrop/ссылке/Esc закрывает drawer; body overflow блокируется пока drawer открыт. Брейкпоинт: md (768px). Sidebar content (nav + модули + user-footer) — один JSX `sidebarNav`, шарится между desktop aside и mobile drawer. Drag-and-drop модулей работает только на десктопе (dragHappened ref защищает от навигации после дропа).
- Сайдбар: навигационные пункты (Главная/Модули/Аналитика/Настройки) оформлены в едином стиле с модульными иконками — Lucide React иконки (Home, LayoutGrid, BarChart3, Settings), у каждого свой акцентный цвет (как у модулей), активное состояние: icon-bg + text цвет через style={}. Определены в OSLayout.jsx в NAV_ITEMS[].
- Профиль пользователя: клик на user-footer сайдбара → ProfilePanel (fixed bottom-left drawer). Поля: display_name, gender, birth_date + авто-возраст, height_cm, weight_kg, activity_level. Сохраняется через profileRepo.upsert. Задел для авто-нормы калорий (Питание).
- Страница /modules: адаптивная сетка карточек (grid-cols-1 sm:2 lg:3 xl:4). Два раздела — «Мои модули» (активные, draggable) + каталог по категориям. Drag-and-drop через dragHappened ref (сброс через setTimeout 200ms) — не ломает клики после дропа. Карточки одинаковой высоты через min-h + flex flex-col + mt-auto для кнопок.

## Заглушки «Функция в разработке» (каркас заложен, без реальной логики)
- Питание: «Посчитать по фото».
- Тренировки и Сон: «Подключить к часам».
- Финансы: «Импортировать выписку» (на будущее — анти-дубль через import_hash + авто-категоризация).
Клик по такой кнопке показывает «Функция в разработке».

## Онбординг
- Флоу: новый пользователь (нет строки профиля ИЛИ onboarding_completed = false) → редирект на /onboarding после логина (AuthScreen проверяет profileRepo.get → если !onboarding_completed → router.replace('/onboarding')). Существующие пользователи (onboarding_completed = true) попадают сразу на /home.
- Гейтинг в самом /onboarding: при маунте проверяет profileRepo.get; если already completed → router.replace('/home') (нельзя вернуться руками). Нет строки профиля = нужен онбординг.
- Мастер (app/components/OnboardingClient.jsx): 5 шагов — 0:Приветствие (display_name + username), 1:Модули (user_modules), 2:Профиль здоровья (gender/birth_date/height_cm/weight_kg/activity_level, опционально, «Пропустить»), 3:Тема (user_profiles.theme, применяется live), 4:Готово (onboarding_completed=true через completeOnboarding).
- Сохранение пошаговое: каждый шаг пишет в БД через profileRepo.upsert / userModulesRepo.upsert до перехода на следующий. Случайная перезагрузка не сбрасывает уже введённое.
- Таблицы/поля: user_profiles (display_name, username, gender, birth_date, height_cm, weight_kg, activity_level, theme, onboarding_completed); user_modules (module_id, is_active, position).
- Миграция 0020 (supabase/migrations/0020_onboarding_backfill.sql): ADD COLUMN IF NOT EXISTS onboarding_completed + UPDATE SET onboarding_completed=true для всех существующих пользователей (бэкфилл).

## Миграции
- Последовательные пронумерованные файлы (на данный момент до 0021). Идемпотентность: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / DROP POLICY IF EXISTS.
- Новый модуль = новая миграция + lib/db + lib/selectors + компонент + регистрация модуля + (опц.) слой календаря.

## Деплой / окружение
- Деплой на Railway: Deploy from GitHub repo, ветка main, авто-деплой по push.
- Build: `npm run build`. Start: `next start -p $PORT` — Railway передаёт порт через $PORT, порт не хардкодить.
- ENV (в Railway): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
- Node: >=20 (зафиксировано в .nvmrc и engines в package.json).
- supabaseAdmin инициализировать лениво, чтобы билд не падал без env.

## Мобильные соглашения (< md = < 768px)
- Сетка модулей (/modules): `grid-cols-2` на мобиле (не `grid-cols-1`). Десктоп: lg:3, xl:4.
- Скролл-контейнер OSLayout: `h-[100dvh]` (не `100vh`) + `padding-bottom: env(safe-area-inset-bottom)` на `<main>` для safe-area (notch/home indicator). viewport meta: `viewportFit: 'cover'` в `export const viewport` в layout.js.
- iOS-зум при фокусе на input: предотвращается через `font-size: 16px !important` на все input/textarea/select на мобиле (globals.css @media max-width:767px). НЕ использовать `maximum-scale` или `user-scalable=no`.
- Выпадающие списки/поповеры не должны уезжать за правый край: Select.jsx — левая граница дропдауна clamped в `[8px, viewport − width − 8px]`; DatePicker.jsx — `alignRight` флаг, флипает на `right-0` если открытие слева выйдет за экран; FocusModule PomodoroHint tooltip — `max-w-[calc(100vw-2rem)]`; DayPopover — уже bottom-sheet на мобиле.
- Горизонтальный скролл/layout shift не допускается — `html { overflow-x: clip }` глобально. Портальные дропдауны не добавляют ширину к странице. Dev-хелпер: `data-overflow-debug` на `<html>` рисует красные outline на всех дочерних элементах.
- Боковые панели (GoalsModule, JournalModule, ProjectsModule): `SidePanel` (app/components/SidePanel.jsx) — full-screen overlay на мобиле + backdrop, `md:relative md:w-[xxx] md:shrink-0 md:border-l` на десктопе.
- Двухколоночные раскладки: НЕТ у Sleep/Nutrition/Finance/Fitness — все используют единый каркас: шапка icon+title+subtitle+кнопка «Добавить» справа, строка стат-метрик с переключателем Неделя/Месяц, список записей. Левая мини-календарная колонка убрана из этих модулей.
- Фокус-модуль: таймер + панель статистики стекуются вертикально (`md:flex md:h-full`), разделитель `border-t md:border-t-0 md:border-l`.
- HabitsModule QuickAdd: двухстрочный layout — первая строка emoji+input, вторая colorpicker+кнопка.
- ModuleStore каталог: активные модули скрыты из категорий (не дублируются); пустые категории не рендерятся.

## Сетевые ошибки и устойчивость (ВАЖНО)
- lib/net.js — `authWithRetry(fn, opts)`: оборачивает supabase auth call в 2 ретрая с экспоненциальным backoff (1.2s/2.4s); ловит TypeError «Load failed»/«Failed to fetch» (WebKit/iOS Safari); нормализует в `{ data, error }` — никогда не бросает. Использовать для signUp/signIn/resend.
- `getSession()` в auth.js + store.js ОБЯЗАН иметь `.catch()` — без него холодный старт вешает приложение навсегда (loading никогда не снимается).
- Supabase возвращает `{ error: { message: 'Load failed' } }` при сетевом сбое (не бросает). В ERROR_MAP нужны ключи 'Load failed', 'Failed to fetch', 'NetworkError'.
- `isNetworkError(err)` из lib/net.js — общий хелпер для определения транзиентных сетевых ошибок.
- OnboardingClient gate check (profileRepo.get) должен иметь fallback timeout (2s), чтобы холодный старт не блокировал показ визарда.

## Грабли (известные)
- Next.js 15+: `params` в route handlers (route.js) и Server Components (page.js, generateMetadata) — **Promise**, нужно `await`. Синхронный доступ `params.slug` возвращает `undefined` → запрос к Supabase с `eq('slug', undefined)` ничего не находит → 404. Паттерн: `const { slug } = await context.params` (route.js) / `const { slug } = await params` (page.js).
- После drag&drop в сайдбаре сбрасывать драг-состояние, иначе навигация виснет до ре-рендера. Порядок модулей персистить в user_modules.position.
- Не отправлять не-uuid в *_id колонки (иначе 22P02). Если значения нет — слать null.
- Новые таблицы без RLS-политик = пустые ответы под анонимной сессией. Всегда добавлять политики.
- getSession() без .catch() = вечный спиннер при сетевом сбое. Всегда добавлять .catch(() => setSession(null)).finally(() => setLoading(false)).

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
