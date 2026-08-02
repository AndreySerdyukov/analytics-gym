---
title: ARPU и ARPPU по странам
block: sql
topic: product-metrics
difficulty: medium
tags: [arpu, left-join, coalesce, filter]
source: interview
estimated_minutes: 20
dataset: ecommerce-v1
check:
  ordered: true
  tolerance: 0.01
  ignore_column_names: true
---

## Условие

Для каждой страны посчитай ARPU и ARPPU по оплаченным заказам:

- ARPU — средняя выручка на пользователя, включая тех, кто ничего не купил;
- ARPPU — средняя выручка на платящего пользователя.

Округли оба значения до двух знаков, отсортируй по стране.

## Решение

```sql
WITH user_revenue AS (
    SELECT
        u.user_id,
        u.country,
        COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.user_id AND o.status = 'paid'
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    GROUP BY u.user_id, u.country
)
SELECT
    country,
    ROUND(AVG(revenue), 2) AS arpu,
    ROUND(AVG(revenue) FILTER (WHERE revenue > 0), 2) AS arppu
FROM user_revenue
GROUP BY country
ORDER BY country;
```

## Разбор

Вся суть задачи — в знаменателе. ARPU делится на **всех** пользователей, ARPPU — только на
платящих. Отсюда два требования к запросу:

1. неплатящие пользователи обязаны дойти до финальной агрегации, поэтому соединение `LEFT`
   и условие `status = 'paid'` стоит в `ON`: в `WHERE` оно бы выкинуло их из выборки, и ARPU
   молча превратился бы в ARPPU;
2. `COALESCE(…, 0)` превращает их `NULL`-выручку в ноль, иначе `AVG` проигнорирует эти строки
   (`AVG` не считает `NULL`) — и знаменатель снова окажется числом платящих.

Полезно помнить соотношение: `ARPU = ARPPU × доля платящих`. Если на собеседовании просят
объяснить, почему ARPU упал, первый вопрос — что именно изменилось: средний чек платящих или
их доля. Это два совершенно разных диагноза.

Что спросят следом: почему ARPU по странам нельзя сравнивать напрямую (разная валюта, разный
состав когорт, разный срок жизни аудитории) и чем поможет нормировка на срок с момента
регистрации.
