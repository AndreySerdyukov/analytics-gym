-- title: Интернет-магазин (v1)
-- description: users, products, orders, order_items, events — витрина для продуктовых SQL-задач

CREATE TABLE users (
    user_id       integer PRIMARY KEY,
    registered_at date NOT NULL,
    country       text NOT NULL,
    source        text NOT NULL          -- organic | ads | referral
);

CREATE TABLE products (
    product_id integer PRIMARY KEY,
    title      text NOT NULL,
    category   text NOT NULL,
    price      numeric(10, 2) NOT NULL
);

CREATE TABLE orders (
    order_id   integer PRIMARY KEY,
    user_id    integer NOT NULL REFERENCES users (user_id),
    created_at timestamp NOT NULL,
    status     text NOT NULL             -- paid | cancelled
);

CREATE TABLE order_items (
    order_id   integer NOT NULL REFERENCES orders (order_id),
    product_id integer NOT NULL REFERENCES products (product_id),
    quantity   integer NOT NULL,
    price      numeric(10, 2) NOT NULL,  -- цена на момент покупки
    PRIMARY KEY (order_id, product_id)
);

CREATE TABLE events (
    event_id    bigint PRIMARY KEY,
    user_id     integer NOT NULL REFERENCES users (user_id),
    event_type  text NOT NULL,           -- view | cart | purchase
    occurred_at timestamp NOT NULL
);

-- seed

-- Данные генерируются детерминированной арифметикой без random():
-- результат одинаков при каждом прогоне, иначе эталонные ответы «плавали» бы.

INSERT INTO users (user_id, registered_at, country, source)
SELECT
    i,
    DATE '2024-01-01' + ((i * 3) % 84),
    (ARRAY['RU', 'KZ', 'BY', 'AM'])[1 + (i % 4)],
    (ARRAY['organic', 'ads', 'referral'])[1 + (i % 3)]
FROM generate_series(1, 40) AS s (i);

INSERT INTO products (product_id, title, category, price) VALUES
    (1,  'Наушники TWS',          'Электроника', 5990.00),
    (2,  'Клавиатура механика',   'Электроника', 8490.00),
    (3,  'Монитор 27"',           'Электроника', 24990.00),
    (4,  'Кофеварка',             'Дом',         12990.00),
    (5,  'Набор кастрюль',        'Дом',         6490.00),
    (6,  'Плед',                  'Дом',         2290.00),
    (7,  'Кроссовки беговые',     'Спорт',       9990.00),
    (8,  'Гантели 2х8 кг',        'Спорт',       4590.00),
    (9,  'Коврик для йоги',       'Спорт',       1890.00),
    (10, 'Рюкзак городской',      'Аксессуары',  3990.00),
    (11, 'Термокружка',           'Аксессуары',  1290.00),
    (12, 'Зонт автомат',          'Аксессуары',  1590.00);

-- Заказы привязаны к дате регистрации пользователя: покупка не может случиться раньше,
-- чем человек зарегистрировался. Каждый пятый пользователь заказов не делает вовсе —
-- это нужно для задач на антисоединения.
INSERT INTO orders (order_id, user_id, created_at, status)
SELECT
    row_number() OVER (ORDER BY u.user_id, g.n)::integer,
    u.user_id,
    (u.registered_at + ((g.n * 9 + u.user_id) % 60))::timestamp
        + make_interval(mins => (u.user_id * 37 + g.n * 53) % 1440),
    CASE WHEN (u.user_id + g.n) % 11 = 0 THEN 'cancelled' ELSE 'paid' END
FROM users u
CROSS JOIN generate_series(1, 1 + (u.user_id % 4)) AS g (n)
WHERE u.user_id % 5 <> 0;

INSERT INTO order_items (order_id, product_id, quantity, price)
SELECT DISTINCT ON (o.order_id, p.product_id)
    o.order_id,
    p.product_id,
    1 + (o.order_id + g.k) % 3,
    p.price
FROM orders o
CROSS JOIN LATERAL generate_series(0, o.order_id % 3) AS g (k)
JOIN products p ON p.product_id = 1 + ((o.order_id * 7 + g.k * 5) % 12)
ORDER BY o.order_id, p.product_id, g.k;

-- События покрывают воронку view → cart → purchase.
-- Они намеренно идут группами по 2-3 штуки в один день с интервалом в считаные минуты:
-- так работают и задачи на retention (группы разнесены по дням от регистрации), и задачи
-- на разбиение активности по сессиям (внутри группы разрыв меньше 30 минут).
INSERT INTO events (event_id, user_id, event_type, occurred_at)
SELECT
    row_number() OVER (ORDER BY u.user_id, g.n),
    u.user_id,
    CASE
        WHEN g.n % 6 = 0 THEN 'purchase'
        WHEN g.n % 3 = 0 THEN 'cart'
        ELSE 'view'
    END,
    (u.registered_at + (((g.n / 3) * 5 + u.user_id) % 40))::timestamp
        + make_interval(
            hours => (u.user_id * 7) % 18,
            mins => (g.n % 3) * 13 + (g.n * 7 + u.user_id * 11) % 9
        )
FROM users u
CROSS JOIN generate_series(1, 5 + (u.user_id % 7)) AS g (n);
