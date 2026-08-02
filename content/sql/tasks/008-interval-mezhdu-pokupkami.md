---
title: Средний интервал между покупками пользователя
block: sql
topic: window-functions
difficulty: medium
tags: [window-functions, lag, self-join]
source: interview
company: Wildberries
estimated_minutes: 20
dataset: ecommerce-v1
check:
  ordered: true
  tolerance: 0.01
  ignore_column_names: true
---

## Условие

Для пользователей, у которых больше одного оплаченного заказа, посчитай среднее число дней
между соседними покупками.

Верни `user_id` и средний интервал в днях, округлённый до двух знаков. Отсортируй по `user_id`.

## Решение

```sql
WITH gaps AS (
    SELECT
        user_id,
        created_at::date - LAG(created_at::date) OVER (
            PARTITION BY user_id ORDER BY created_at
        ) AS gap_days
    FROM orders
    WHERE status = 'paid'
)
SELECT
    user_id,
    ROUND(AVG(gap_days), 2) AS avg_gap_days
FROM gaps
WHERE gap_days IS NOT NULL
GROUP BY user_id
ORDER BY user_id;
```

## Разбор

`LAG` даёт значение предыдущей строки внутри партиции. У первого заказа предыдущего нет,
поэтому там `NULL` — и это ровно то, что нужно: фильтр `gap_days IS NOT NULL` заодно
отсекает пользователей с единственной покупкой, отдельное условие `HAVING COUNT(*) > 1`
не требуется.

Тонкость с типами: `timestamp - timestamp` даёт `interval`, а `date - date` — целое число дней.
Приведение `created_at::date` внутри `LAG` делает арифметику предсказуемой. Если нужна точность
до часов, вычитайте `timestamp` и работайте с `interval`, но тогда `AVG` вернёт интервал,
а не число, и `ROUND` к нему уже не применить напрямую.

Альтернатива без окон — self-join, где к каждому заказу подтягивается ближайший следующий.
Работает, но требует коррелированного подзапроса с `MIN(created_at) WHERE created_at > …`
и на больших таблицах ведёт себя заметно хуже.

Что спросят следом: как найти пользователей, «выпавших» из активности — тех, у кого последний
интервал сильно больше их обычного. Это уже сравнение `LAG`-интервала со средним по пользователю
в одном запросе, то есть оконная функция поверх оконной через CTE.
