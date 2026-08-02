---
title: Воронка view → cart → purchase
block: sql
topic: product-metrics
difficulty: medium
tags: [funnel, filter, count-distinct, conversion]
source: interview
company: Ozon
estimated_minutes: 20
dataset: ecommerce-v1
check:
  ordered: false
  tolerance: 0.01
  ignore_column_names: true
---

## Условие

Построй воронку по пользователям: сколько уникальных пользователей сделали событие `view`,
сколько `cart`, сколько `purchase`. Посчитай две конверсии в процентах, округлив до двух знаков:
из просмотра в корзину и из корзины в покупку.

Верни одну строку с пятью значениями.

## Решение

```sql
WITH funnel AS (
    SELECT
        COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'view')     AS viewers,
        COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'cart')     AS carters,
        COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'purchase') AS buyers
    FROM events
)
SELECT
    viewers,
    carters,
    buyers,
    ROUND(100.0 * carters / viewers, 2) AS view_to_cart_pct,
    ROUND(100.0 * buyers / carters, 2)  AS cart_to_purchase_pct
FROM funnel;
```

## Разбор

`FILTER (WHERE …)` — способ посчитать несколько срезов за одно сканирование таблицы. Он читается
лучше, чем `COUNT(DISTINCT CASE WHEN event_type = 'view' THEN user_id END)`, и делает ровно то же.
В диалектах без `FILTER` (например, в MySQL) остаётся вариант с `CASE`.

Главная содержательная оговорка: это **не последовательная воронка**. Запрос считает, кто
вообще совершал каждое действие, не проверяя порядок событий во времени. Пользователь, который
купил, но ни разу не просматривал (пришёл по прямой ссылке), попадёт в `buyers`, не попав в
`viewers` — и конверсия «корзина → покупка» теоретически может превысить 100%.

Честная последовательная воронка требует проверки, что `cart` случился **после** `view` того же
пользователя, а `purchase` — после `cart`. Обычно это делают через оконные функции или
самосоединение с условием по времени. На собеседовании ценят, когда кандидат сам проговаривает
эту разницу, а не молча считает пересечение множеств.

Что спросят следом: как посчитать воронку в разрезе источника трафика и почему сравнивать
конверсии между источниками напрямую опасно (разный состав аудитории — парадокс Симпсона).
