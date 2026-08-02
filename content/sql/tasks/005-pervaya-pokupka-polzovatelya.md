---
title: Первая покупка каждого пользователя
block: sql
topic: joins
difficulty: medium
tags: [distinct-on, window-functions, first-value]
source: interview
company: Авито
estimated_minutes: 15
dataset: ecommerce-v1
check:
  ordered: true
  tolerance: 0.001
  ignore_column_names: true
---

## Условие

Для каждого пользователя, у которого есть оплаченные заказы, найди его первый оплаченный заказ.

Верни `user_id`, `order_id` и дату-время заказа. Отсортируй по `user_id`.

## Решение

```sql
SELECT DISTINCT ON (o.user_id)
    o.user_id,
    o.order_id,
    o.created_at
FROM orders o
WHERE o.status = 'paid'
ORDER BY o.user_id, o.created_at;
```

## Разбор

`DISTINCT ON` — расширение Postgres, которого нет в стандарте: оно оставляет первую строку
для каждой комбинации перечисленных выражений. Главное правило — `ORDER BY` обязан начинаться
с тех же выражений, что и `DISTINCT ON`, иначе «первая» строка не определена.

Переносимый вариант через оконную функцию:

```sql
SELECT user_id, order_id, created_at
FROM (
    SELECT o.*, ROW_NUMBER() OVER (PARTITION BY o.user_id ORDER BY o.created_at) AS rn
    FROM orders o
    WHERE o.status = 'paid'
) t
WHERE rn = 1
ORDER BY user_id;
```

Почему нельзя просто `GROUP BY user_id` с `MIN(created_at)`: тогда нельзя вытащить `order_id`
той самой строки. `MIN(order_id)` вернёт заказ с наименьшим идентификатором, а это другой заказ.
Ошибка тем коварнее, что на маленьких данных ответы часто совпадают.

Что спросят следом: чем `ROW_NUMBER` отличается от `RANK` и `DENSE_RANK`. При равных
`created_at` `ROW_NUMBER` всё равно оставит одну строку, а `RANK` даст обе — и результат
раздвоится.
