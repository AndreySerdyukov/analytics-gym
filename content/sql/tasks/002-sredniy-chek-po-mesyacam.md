---
title: Средний чек по месяцам
block: sql
topic: basics
difficulty: easy
tags: [group-by, date-trunc, subquery]
source: interview
company: Ozon
estimated_minutes: 15
dataset: ecommerce-v1
check:
  ordered: true
  tolerance: 0.01
  ignore_column_names: true
---

## Условие

Посчитай средний чек по месяцам для оплаченных заказов. Чек — сумма всех позиций заказа.

Верни месяц (первое число) и средний чек, округлённый до двух знаков. Отсортируй по месяцу.

## Решение

```sql
WITH order_totals AS (
    SELECT
        oi.order_id,
        SUM(oi.quantity * oi.price) AS order_total
    FROM order_items oi
    GROUP BY oi.order_id
)
SELECT
    date_trunc('month', o.created_at)::date AS month,
    ROUND(AVG(t.order_total), 2) AS avg_check
FROM orders o
JOIN order_totals t ON t.order_id = o.order_id
WHERE o.status = 'paid'
GROUP BY 1
ORDER BY 1;
```

## Разбор

Ключевая ошибка на собеседовании — посчитать `AVG(oi.quantity * oi.price)` напрямую по
`order_items`. Это даст среднюю **позицию**, а не средний **чек**: заказ из пяти позиций
попадёт в среднее пять раз. Агрегировать нужно в два этапа: сначала свернуть позиции в чек,
потом усреднить чеки.

`date_trunc('month', …)` возвращает `timestamp` — приведение `::date` нужно, чтобы в выдаче
не было бессмысленного `00:00:00`. Вариант с `EXTRACT(month …)` хуже: он склеит январь 2024 и
январь 2025 в одну группу.

Что спросят следом: чем средний чек хуже медианного. Средний чувствителен к выбросам — один
заказ на монитор перекосит месяц. На проде обычно смотрят и медиану, и p90.
