---
title: Retention первой недели по когортам регистрации
block: sql
topic: cohorts
difficulty: hard
tags: [cohort, retention, date-trunc, left-join]
source: interview
company: VK
estimated_minutes: 30
dataset: ecommerce-v1
check:
  ordered: true
  tolerance: 0.01
  ignore_column_names: true
---

## Условие

Раздели пользователей на когорты по неделе регистрации. Для каждой когорты посчитай:

- размер когорты;
- сколько пользователей вернулись — то есть имели хотя бы одно событие в течение первых семи
  дней после регистрации (дни с первого по седьмой включительно, день регистрации не считается);
- retention в процентах, округлённый до двух знаков.

Отсортируй по неделе когорты.

## Решение

```sql
SELECT
    date_trunc('week', u.registered_at)::date AS cohort_week,
    COUNT(DISTINCT u.user_id) AS cohort_size,
    COUNT(DISTINCT e.user_id) AS retained_users,
    ROUND(100.0 * COUNT(DISTINCT e.user_id) / COUNT(DISTINCT u.user_id), 2) AS retention_pct
FROM users u
LEFT JOIN events e
       ON e.user_id = u.user_id
      AND e.occurred_at::date BETWEEN u.registered_at + 1 AND u.registered_at + 7
GROUP BY 1
ORDER BY 1;
```

## Разбор

Три вещи, которые здесь проверяют.

**Условие окна retention живёт в `ON`, а не в `WHERE`.** Если перенести его в `WHERE`,
`LEFT JOIN` схлопнется во внутренний: когорты, где никто не вернулся, исчезнут из выдачи
целиком, и retention по ним будет не 0%, а «нет строки». График молча потеряет точки, а
средний retention окажется завышенным. Это самая частая ошибка в когортных запросах.

**`COUNT(DISTINCT e.user_id)` не считает `NULL`.** У невернувшихся пользователей после
`LEFT JOIN` в `e.user_id` будет `NULL`, и они автоматически не попадут в числитель. Отдельный
`CASE WHEN … THEN 1 END` не нужен.

**`100.0`, а не `100`.** Деление целых в Postgres целочисленное: `100 * 3 / 10` даст 30, а
не 30.0, и почти любой retention округлится до нуля или до целых процентов. Множитель с точкой
переводит выражение в `numeric`, после чего `ROUND(…, 2)` работает как ожидается.

Отдельно про `date_trunc('week', …)`: в Postgres неделя начинается с понедельника по ISO.
Если аналитика в компании считает недели с воскресенья, цифры не сойдутся с дашбордом — это
стоит уточнять до, а не после того, как отдал результат.

Что спросят следом: как построить полную когортную таблицу — retention по неделям 1, 2, 3, …
Ответ: соединить когорты с `generate_series` номеров недель и считать активность в каждом окне,
получая треугольную матрицу.
