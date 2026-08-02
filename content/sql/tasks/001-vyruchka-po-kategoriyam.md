---
title: Выручка по категориям товаров
block: sql
topic: basics
difficulty: easy
tags: [group-by, join, aggregation]
source: own
estimated_minutes: 10
dataset: ecommerce-v1
check:
  ordered: true
  tolerance: 0.001
  ignore_column_names: true
---

## Условие

Посчитай выручку по категориям товаров. Учитывай только оплаченные заказы (`status = 'paid'`).
Выручка позиции — количество, умноженное на цену на момент покупки.

Верни две колонки: категорию и выручку, отсортируй по убыванию выручки.

## Решение

```sql
SELECT
    p.category,
    SUM(oi.quantity * oi.price) AS revenue
FROM order_items oi
JOIN orders o ON o.order_id = oi.order_id AND o.status = 'paid'
JOIN products p ON p.product_id = oi.product_id
GROUP BY p.category
ORDER BY revenue DESC;
```

## Разбор

Три момента, на которых спотыкаются:

1. **Фильтр по статусу в `ON`, а не в `WHERE`.** Здесь разницы нет, потому что соединение
   внутреннее. Но стоит завести привычку понимать, где фильтр меняет результат: при `LEFT JOIN`
   условие в `ON` отсекает строки правой таблицы, а такое же условие в `WHERE` превратит
   соединение во внутреннее и выкинет строки левой таблицы целиком.
2. **Цена берётся из `order_items`, а не из `products`.** В `products` лежит текущая цена,
   в `order_items` — цена на момент покупки. Джойн к `products` нужен только ради категории.
3. **Сортировка по алиасу.** В `ORDER BY` алиас из `SELECT` использовать можно, в `WHERE` — нет:
   `WHERE` выполняется до формирования проекции.

Что спросят следом: как добавить долю категории в общей выручке. Ответ — оконная функция:
`SUM(...) * 100.0 / SUM(SUM(...)) OVER ()`. Двойная агрегация внутри окна выглядит странно,
но она законна: окно применяется уже к результату группировки.
