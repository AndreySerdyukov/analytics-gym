---
title: Накопительная выручка по дням
block: sql
topic: window-functions
difficulty: medium
tags: [window-functions, running-total, frame]
source: own
estimated_minutes: 15
dataset: ecommerce-v1
check:
  ordered: true
  tolerance: 0.001
  ignore_column_names: true
---

## Условие

Посчитай выручку по дням (только оплаченные заказы) и нарастающий итог с начала наблюдений.

Верни день, выручку за день и накопительную выручку. Отсортируй по дню.

## Решение

```sql
WITH daily AS (
    SELECT
        o.created_at::date AS day,
        SUM(oi.quantity * oi.price) AS revenue
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.order_id
    WHERE o.status = 'paid'
    GROUP BY 1
)
SELECT
    day,
    revenue,
    SUM(revenue) OVER (ORDER BY day) AS cumulative_revenue
FROM daily
ORDER BY day;
```

## Разбор

Главное здесь — рамка окна. Когда в `OVER` есть `ORDER BY`, но нет явного `ROWS`/`RANGE`,
Postgres подставляет `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. Именно это и даёт
нарастающий итог. Без `ORDER BY` в окне рамка была бы «вся партиция», и в каждой строке
оказалась бы общая сумма за весь период.

Разница `RANGE` и `ROWS` проявляется на дублях в сортировке: `RANGE` включает **все** строки
с тем же значением `day`, `ROWS` — строго предыдущие строки. Здесь дублей нет, потому что
`daily` уже сгруппирован по дню, но на сырых данных `ROWS` и `RANGE` дали бы разные ответы.
Это любимый вопрос на собеседовании.

Практическая деталь: в этом наборе есть дни без заказов, и они просто отсутствуют в выдаче.
Если нужен непрерывный ряд дат, левым джойном подтягивают
`generate_series(min_day, max_day, '1 day')` — иначе график с пропущенными днями врёт.

Что спросят следом: скользящее среднее за 7 дней. Это та же конструкция с явной рамкой
`ROWS BETWEEN 6 PRECEDING AND CURRENT ROW`.
