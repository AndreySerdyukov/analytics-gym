---
title: Пользователи без единого заказа
block: sql
topic: joins
difficulty: easy
tags: [anti-join, left-join, not-exists]
source: interview
company: Яндекс
estimated_minutes: 10
dataset: ecommerce-v1
check:
  ordered: true
  tolerance: 0.001
  ignore_column_names: true
---

## Условие

Найди пользователей, которые не сделали ни одного заказа — включая отменённые.

Верни `user_id`, дату регистрации и страну, отсортируй по `user_id`.

## Решение

```sql
SELECT
    u.user_id,
    u.registered_at,
    u.country
FROM users u
LEFT JOIN orders o ON o.user_id = u.user_id
WHERE o.order_id IS NULL
ORDER BY u.user_id;
```

## Разбор

Классический антиджойн. Три способа написать его и разница между ними:

| Способ | Поведение |
|---|---|
| `LEFT JOIN … WHERE right.id IS NULL` | Понятен, работает везде. Требует уникальности справа, иначе перед фильтром размножит строки |
| `NOT EXISTS (SELECT 1 …)` | Обычно самый быстрый в Postgres, планировщик разворачивает в anti join |
| `NOT IN (SELECT …)` | **Опасен:** если подзапрос вернёт хотя бы один `NULL`, результат будет пустым |

Про `NOT IN` спрашивают почти всегда. Причина в трёхзначной логике: `x NOT IN (1, NULL)`
раскрывается в `x <> 1 AND x <> NULL`, второе условие даёт `UNKNOWN`, а `TRUE AND UNKNOWN`
— это `UNKNOWN`, то есть строка не проходит фильтр. Молча, без ошибки.

Что спросят следом: как найти тех, кто регистрировался, но не покупал **в конкретном месяце**.
Тогда условие по дате должно уехать в `ON`, а не в `WHERE`, иначе `LEFT JOIN` схлопнется
во внутренний.
