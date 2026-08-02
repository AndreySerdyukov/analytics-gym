---
title: Медиана и p90 чека
block: sql
topic: product-metrics
difficulty: hard
tags: [percentile-cont, ordered-set-aggregate, distribution]
source: interview
company: Тинькофф
estimated_minutes: 15
dataset: ecommerce-v1
check:
  ordered: false
  tolerance: 0.01
  ignore_column_names: true
---

## Условие

По оплаченным заказам посчитай распределение чека: средний чек, медиану и 90-й перцентиль.
Средний чек округли до двух знаков.

Верни одну строку с тремя значениями.

## Решение

```sql
WITH checks AS (
    SELECT
        o.order_id,
        SUM(oi.quantity * oi.price) AS order_total
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.order_id
    WHERE o.status = 'paid'
    GROUP BY o.order_id
)
SELECT
    ROUND(AVG(order_total), 2) AS avg_check,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY order_total) AS median_check,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY order_total) AS p90_check
FROM checks;
```

## Разбор

`PERCENTILE_CONT` — агрегат упорядоченного множества, поэтому у него необычный синтаксис с
`WITHIN GROUP (ORDER BY …)`. Это не оконная функция, хотя выглядит похоже.

Разница двух вариантов, и её любят спрашивать:

- `PERCENTILE_CONT` **интерполирует** между соседними значениями. Медиана четырёх чеков
  100, 200, 300, 400 будет 250 — такого чека в данных нет;
- `PERCENTILE_DISC` возвращает **реально существующее** значение из набора, для того же примера — 200.

Для денег обычно берут `CONT`, для «покажи типичный заказ» — `DISC`.

Зачем вообще медиана, когда есть среднее: распределение чеков почти всегда скошено вправо.
Несколько заказов на монитор поднимут средний чек, хотя половина покупателей берёт термокружку
за 1290. Медиана и p90 показывают форму распределения: если p90 в разы больше медианы, значит
выручку делает узкая группа, и работать с ней нужно отдельно.

Что спросят следом: как посчитать перцентили в разрезе категорий (добавить `GROUP BY`) и как
это делается в диалектах без `PERCENTILE_CONT` — через `ROW_NUMBER` и выбор середины
отсортированного ряда.
