---
title: Купили электронику, но не спорттовары
block: sql
topic: joins
difficulty: medium
tags: [anti-join, except, not-exists]
source: interview
estimated_minutes: 15
dataset: ecommerce-v1
check:
  ordered: true
  tolerance: 0.001
  ignore_column_names: true
---

## Условие

Найди пользователей, которые покупали товары категории «Электроника» и при этом ни разу
не покупали товары категории «Спорт». Учитывай только оплаченные заказы.

Верни `user_id`, отсортируй по возрастанию.

## Решение

```sql
SELECT DISTINCT o.user_id
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
JOIN products p ON p.product_id = oi.product_id
WHERE o.status = 'paid'
  AND p.category = 'Электроника'
  AND NOT EXISTS (
      SELECT 1
      FROM orders o2
      JOIN order_items oi2 ON oi2.order_id = o2.order_id
      JOIN products p2 ON p2.product_id = oi2.product_id
      WHERE o2.user_id = o.user_id
        AND o2.status = 'paid'
        AND p2.category = 'Спорт'
  )
ORDER BY o.user_id;
```

## Разбор

Типичная ошибка — написать условие в одном `WHERE`:

```sql
WHERE p.category = 'Электроника' AND p.category <> 'Спорт'   -- бессмыслица
```

Условие применяется к **строке**, а не к пользователю: одна строка не может быть одновременно
электроникой и не спортом в интересующем нас смысле. Нужны два независимых утверждения о
пользователе, поэтому второе выносится в подзапрос.

Альтернатива через `EXCEPT` читается короче:

```sql
SELECT user_id FROM ... WHERE category = 'Электроника'
EXCEPT
SELECT user_id FROM ... WHERE category = 'Спорт'
```

`EXCEPT` заодно убирает дубликаты, так что `DISTINCT` не нужен. Минус — датасет сканируется
дважды, и на больших таблицах `NOT EXISTS` обычно выигрывает.

Ещё вариант — агрегатный: сгруппировать по пользователю и оставить тех, у кого
`COUNT(*) FILTER (WHERE category = 'Электроника') > 0 AND COUNT(*) FILTER (WHERE category = 'Спорт') = 0`.
Одно сканирование, и логика «утверждение о пользователе» видна явно.
