---
title: Топ-3 товара в каждой категории по выручке
block: sql
topic: window-functions
difficulty: medium
tags: [window-functions, row-number, partition-by]
source: interview
company: Ozon
estimated_minutes: 20
dataset: ecommerce-v1
check:
  ordered: true
  tolerance: 0.001
  ignore_column_names: true
---

## Условие

Для каждой категории найди три товара с наибольшей выручкой по оплаченным заказам.
При равной выручке приоритет у товара с меньшим `product_id`.

Верни категорию, `product_id`, название и выручку. Отсортируй по категории, внутри категории —
по убыванию выручки.

## Решение

```sql
WITH product_revenue AS (
    SELECT
        p.category,
        p.product_id,
        p.title,
        SUM(oi.quantity * oi.price) AS revenue
    FROM order_items oi
    JOIN orders o ON o.order_id = oi.order_id AND o.status = 'paid'
    JOIN products p ON p.product_id = oi.product_id
    GROUP BY p.category, p.product_id, p.title
),
ranked AS (
    SELECT
        pr.*,
        ROW_NUMBER() OVER (
            PARTITION BY pr.category
            ORDER BY pr.revenue DESC, pr.product_id
        ) AS rn
    FROM product_revenue pr
)
SELECT category, product_id, title, revenue
FROM ranked
WHERE rn <= 3
ORDER BY category, rn;
```

## Разбор

Задача на «топ-N внутри группы» — самая частая задача на оконные функции.

Почему нельзя фильтровать окно прямо в `WHERE`: оконные функции вычисляются **после** `WHERE`
и `GROUP BY`, но **до** `ORDER BY` и `LIMIT`. Поэтому `WHERE ROW_NUMBER() OVER (...) <= 3`
— синтаксическая ошибка, окно нужно завернуть в подзапрос или CTE.

Порядок выполнения запроса стоит держать в голове целиком:

```
FROM → WHERE → GROUP BY → HAVING → оконные функции → SELECT → DISTINCT → ORDER BY → LIMIT
```

Выбор ранжирующей функции решает, что будет при ничьей:

- `ROW_NUMBER` — ровно три строки, при равенстве выбор произвольный (потому в `ORDER BY` окна
  добавлен `product_id` — иначе результат недетерминирован);
- `RANK` — при ничьей на третьем месте вернёт четыре строки и пропустит ранг 4;
- `DENSE_RANK` — вернёт все товары трёх лучших **уровней** выручки, их может быть много.

Что спросят следом: как посчитать долю товара в выручке категории. Ответ в том же окне:
`revenue * 100.0 / SUM(revenue) OVER (PARTITION BY category)`.
