---
title: Разбиение событий на сессии
block: sql
topic: window-functions
difficulty: hard
tags: [window-functions, lag, gaps-and-islands, sessionization]
source: interview
company: Яндекс
estimated_minutes: 30
dataset: ecommerce-v1
check:
  ordered: true
  tolerance: 0.001
  ignore_column_names: true
---

## Условие

Разбей события пользователей на сессии. Новая сессия начинается, если между соседними
событиями пользователя прошло 30 минут или больше.

Верни `user_id`, номер сессии внутри пользователя (начиная с 1), время начала, время конца
и число событий в сессии. Отсортируй по `user_id` и номеру сессии.

## Решение

```sql
WITH marked AS (
    SELECT
        user_id,
        occurred_at,
        CASE
            WHEN occurred_at - LAG(occurred_at) OVER (
                     PARTITION BY user_id ORDER BY occurred_at
                 ) < INTERVAL '30 minutes'
            THEN 0
            ELSE 1
        END AS is_new_session
    FROM events
),
numbered AS (
    SELECT
        user_id,
        occurred_at,
        SUM(is_new_session) OVER (
            PARTITION BY user_id ORDER BY occurred_at
        ) AS session_num
    FROM marked
)
SELECT
    user_id,
    session_num,
    MIN(occurred_at) AS started_at,
    MAX(occurred_at) AS finished_at,
    COUNT(*) AS events_count
FROM numbered
GROUP BY user_id, session_num
ORDER BY user_id, session_num;
```

## Разбор

Это задача класса **gaps and islands** — поиск непрерывных «островов» активности. Приём
универсальный и стоит того, чтобы отложиться в память:

1. пометить строки, с которых начинается новый остров (флаг 0/1);
2. взять нарастающую сумму флагов — она и есть номер острова;
3. сгруппировать по этому номеру.

Тонкость с первой строкой: у неё `LAG` возвращает `NULL`, сравнение `NULL < INTERVAL '30 minutes'`
даёт `UNKNOWN`, ветка `WHEN` не срабатывает и `CASE` уходит в `ELSE 1`. То есть первое событие
пользователя автоматически открывает сессию — ровно то поведение, которое нужно, и оно получается
само, без отдельной проверки на `NULL`. Но полагаться на это вслепую опасно: если переписать
условие как `WHEN … >= INTERVAL '30 minutes' THEN 1 ELSE 0`, первая строка получит 0, нумерация
съедет и начнётся с нуля. На собеседовании этот разбор ценят больше самого запроса.

Граница «30 минут» здесь строгая: ровно 30 минут уже начинают новую сессию. Стоит проговорить
это вслух — в реальных ТЗ формулировка почти всегда двусмысленная.

Что спросят следом: как посчитать среднюю длительность сессии и почему сессии из одного события
дают нулевую длительность (и стоит ли их вообще учитывать в среднем).
