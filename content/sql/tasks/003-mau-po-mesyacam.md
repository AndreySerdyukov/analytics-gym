---
title: MAU по месяцам
block: sql
topic: basics
difficulty: easy
tags: [count-distinct, date-trunc]
source: own
estimated_minutes: 5
dataset: ecommerce-v1
check:
  ordered: true
  tolerance: 0.001
  ignore_column_names: true
---

## Условие

Посчитай MAU — число уникальных пользователей, у которых была хотя бы одна активность
в месяце. Активность — любое событие в таблице `events`.

Верни месяц и MAU, отсортируй по месяцу.

## Решение

```sql
SELECT
    date_trunc('month', occurred_at)::date AS month,
    COUNT(DISTINCT user_id) AS mau
FROM events
GROUP BY 1
ORDER BY 1;
```

## Разбор

Задача-разминка, но у неё есть продолжение, которое и проверяют на самом деле: **MAU не
складывается**. Сумма MAU за три месяца не равна квартальному MAU, потому что один и тот же
пользователь считается в каждом месяце заново. Квартальный MAU надо считать отдельным запросом
с `date_trunc('quarter', …)`.

Вторая ловушка — `COUNT(DISTINCT …)` на больших объёмах дорог. В проде вместо него берут
приближённые структуры (HyperLogLog, в Postgres — расширение `postgresql-hll`), теряя доли
процента точности ради скорости.

Что спросят следом: как посчитать sticky factor — отношение DAU к MAU. Это уже требует
считать DAU отдельным запросом и джойнить по месяцу.
