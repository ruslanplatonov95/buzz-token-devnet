# BUZZT — подтверждённый выпуск в Solana Devnet

Дата: 14 октября 2026 года. Сеть: **Solana Devnet**, не Mainnet. Это тестовый токен без денежной стоимости и без публичной продажи.

- Mint: [`4G2iazpsZgQYXD8PMajphG8ziKmn761jg9JtUufwr8rq`](https://explorer.solana.com/address/4G2iazpsZgQYXD8PMajphG8ziKmn761jg9JtUufwr8rq?cluster=devnet)
- Тестовый кошелёк: `H7j7mrThqrPVqkmfTfvA3GirX8ubBv86GY28uh6AXCrD`
- Token account: `72nXjeAHb6cDAGwU53DTosH7GG5kp2SrcxRx4B95DfdW`
- Имя / символ: `BUZZ DEVNET TEST` / `BUZZT`
- Выпущено: 10 000 000 целых единиц; тестовое сжигание: 1; проверенный остаток: 9 999 999.
- Право дополнительной эмиссии отозвано; право заморозки отсутствует.

Транзакции:

1. [Создание mint](https://explorer.solana.com/tx/63wUJbPk2ZioH3hwucW4nnTcDpUCGfkyeoSrFJafe9uWj8RJvbg4S8dvYvLdNPTVKBEJaMij6sDexd5FsozFK6aH?cluster=devnet)
2. [Выпуск 10 000 000 BUZZT](https://explorer.solana.com/tx/56xAhVyW724aWt4tFtviynRn77b5UD89Sydxws9kmcyawU3LxCbEbPRDqFwEKSgwB7jDdHPKDTDu8v24uJJgesug?cluster=devnet)
3. [Отзыв права эмиссии](https://explorer.solana.com/tx/2PjjfQUXTDb3HUxGc6Zp1pwsqtH5XKyQ6BhKGixatUWygquuJiGeRbskFBwvfPgFbjHddP3yDjpyCAPbRPTsdwqH?cluster=devnet)
4. [Тестовое сжигание 1 BUZZT](https://explorer.solana.com/tx/61NSPSNLFL7mN2eByRU7QCvsAE3dAyUZCWGS4qBwLVLXvtrJicWcGQe8JhaYWQoiUojJvEttbmEcUWSt8Bcm9kvQ?cluster=devnet)

Скрипт `issue.mjs` после выпуска запущен повторно: он проверил данные в сети и не выпустил токены ещё раз. Закрытые тестовые ключи остаются локально и не публикуются в репозитории.

## BUZZT2 — дополнительная проверка комиссий и тестового стейкинга

14 октября 2026 года создан второй mint [`4cEMJy562smMVw58Ue2daziWDMiHMwdcRXzKFduCp4dV`](https://explorer.solana.com/address/4cEMJy562smMVw58Ue2daziWDMiHMwdcRXzKFduCp4dV?cluster=devnet) с символом `BUZZT2`, шестью знаками после запятой и комиссией за перевод 1%. Выпущено 10 000 000 тестовых единиц, право дополнительной эмиссии отозвано, право заморозки отсутствует.

Проверенный цикл:

| Действие | Подпись Devnet-транзакции | Результат |
|---|---|---|
| Создание BUZZT2 | [`3D1bPGVyjkXkDFco2mHQhWPZCgV9ayrgu9DQ8xhZ36aQSVMxbXHeP38XiteUArRWPJBK59EGrCBhnWGdrAf585aa`](https://explorer.solana.com/tx/3D1bPGVyjkXkDFco2mHQhWPZCgV9ayrgu9DQ8xhZ36aQSVMxbXHeP38XiteUArRWPJBK59EGrCBhnWGdrAf585aa?cluster=devnet) | Комиссия задана при создании mint |
| Выпуск | [`3bPoPjmoSxiRUFZxqE4GWBZ2axxij2S7DmGodY1g7ujN41XFAm4KBhaW66gYLkZuU8sDQNAetFyCdox3xeYqB3qs`](https://explorer.solana.com/tx/3bPoPjmoSxiRUFZxqE4GWBZ2axxij2S7DmGodY1g7ujN41XFAm4KBhaW66gYLkZuU8sDQNAetFyCdox3xeYqB3qs?cluster=devnet) | 10 000 000 BUZZT2 |
| Отзыв права эмиссии | [`5RGpvVe3oLgoTCHtEcNyScFrCrcXk6cKjTmfcbeQGgK15FiUDk989sXeWb6zYvaDKp7GunLH6ZVPjPwX93nsdzWQ`](https://explorer.solana.com/tx/5RGpvVe3oLgoTCHtEcNyScFrCrcXk6cKjTmfcbeQGgK15FiUDk989sXeWb6zYvaDKp7GunLH6ZVPjPwX93nsdzWQ?cluster=devnet) | Новая эмиссия отключена |
| Перевод | [`5GaC62sJjUnWmTTpVHSimhqag4zhRLdK1mUkhHtZefTwFuhwb5UqXxE9vNGJhXXpE2EoxJT5mMG6rN6sTXvREy5Y`](https://explorer.solana.com/tx/5GaC62sJjUnWmTTpVHSimhqag4zhRLdK1mUkhHtZefTwFuhwb5UqXxE9vNGJhXXpE2EoxJT5mMG6rN6sTXvREy5Y?cluster=devnet) | Из 1 000 токенов получатель получил 990; 10 удержаны |
| Сбор комиссии | [`4y4cGADXRukFf1qPVBwHqsjSkXoAqZVqiVU9qex3H7JnUJEDgi1251xJ4eeYLvcCgfJvEa6kQnT8Tr9kiTEyZHYe`](https://explorer.solana.com/tx/4y4cGADXRukFf1qPVBwHqsjSkXoAqZVqiVU9qex3H7JnUJEDgi1251xJ4eeYLvcCgfJvEa6kQnT8Tr9kiTEyZHYe?cluster=devnet) | Оператор собрал удержанные 10 |
| Сжигание комиссии | [`3u2UqemLp6x9xoAraEyQ3pbegevQFJqVRLv42Qu915SwXvtgNrdse7C2fLEQJP8L9XZmXhzzgWWBVyB3BbhCnZUy`](https://explorer.solana.com/tx/3u2UqemLp6x9xoAraEyQ3pbegevQFJqVRLv42Qu915SwXvtgNrdse7C2fLEQJP8L9XZmXhzzgWWBVyB3BbhCnZUy?cluster=devnet) | Supply стал 9 999 990 |
| Тестовый депозит | [`4yBFBkgX3pmULVdnU6GuSRxiiV4GJyGjKEuPTraWGvBFiCXL64pXUZh2h815zTdnnDM1kia9oMsegLRVuk3cEWSS`](https://explorer.solana.com/tx/4yBFBkgX3pmULVdnU6GuSRxiiV4GJyGjKEuPTraWGvBFiCXL64pXUZh2h815zTdnnDM1kia9oMsegLRVuk3cEWSS?cluster=devnet) | Внесено 500, в хранилище поступило 495 после комиссии 5 |
| Возврат и тестовая награда | [`67qX6EjLWmb5GBoAfaDHYsuud8Ga3fjFYayvZPqyEiVNhoxCnPGj8Mh2duXhzshAMwNKZSgd7qhXdPpxXvjF4u9E`](https://explorer.solana.com/tx/67qX6EjLWmb5GBoAfaDHYsuud8Ga3fjFYayvZPqyEiVNhoxCnPGj8Mh2duXhzshAMwNKZSgd7qhXdPpxXvjF4u9E?cluster=devnet) | Через 32 сек. вернуто 495 до комиссии; тестовая награда 0,000040 до комиссии |
| Сбор и сжигание комиссий | [`5meMKKprzVApoAxy5gHtskbqvY7J9PrysgFuHoyQswo6nH7RZ61X7fu8fMJkRZbnhn8RWRZsXsgqYbX8niPuJQQk`](https://explorer.solana.com/tx/5meMKKprzVApoAxy5gHtskbqvY7J9PrysgFuHoyQswo6nH7RZ61X7fu8fMJkRZbnhn8RWRZsXsgqYbX8niPuJQQk?cluster=devnet), [`21x5fr5PA48wWXc4yUcFPxSGNztggGptoMSZVwzDkLBe2hZ3ZWwkfNfT2DmvvF8ZSrcP1rm5XgAd9crGqE6JSH7R`](https://explorer.solana.com/tx/21x5fr5PA48wWXc4yUcFPxSGNztggGptoMSZVwzDkLBe2hZ3ZWwkfNfT2DmvvF8ZSrcP1rm5XgAd9crGqE6JSH7R?cluster=devnet) | Дополнительно сожжено 9,950001; supply после этого этапа 9 999 980,049999 |
| Дополнительный тестовый перевод | [`45yXM85EV36B9aWfsjUvHjSQexLcjHaWaSXGMrDLnT3McAgpxpaULRpFK4A3DmJ8Zn5jFvDA3eiTyigQawyzUEsR`](https://explorer.solana.com/tx/45yXM85EV36B9aWfsjUvHjSQexLcjHaWaSXGMrDLnT3McAgpxpaULRpFK4A3DmJ8Zn5jFvDA3eiTyigQawyzUEsR?cluster=devnet) | Из 100 токенов 1 удержан |
| Воркер: сбор и сжигание | [`2hnYvvtewoCxBmqPYiJvMwAwbXyVkv97SLef9n8LmRns27845SsXY4hRkYGjKj5SGVC7nYMu8gkAVgYiL4f73u5e`](https://explorer.solana.com/tx/2hnYvvtewoCxBmqPYiJvMwAwbXyVkv97SLef9n8LmRns27845SsXY4hRkYGjKj5SGVC7nYMu8gkAVgYiL4f73u5e?cluster=devnet), [`23Zvt1jemoSCDPbGL3WniGppuAYpwekhwcnsr4ZhJE5FhwoLzyfQajBEY1P56ZMRrkxwhTJsVdMXpLVAfVSYXoZ9`](https://explorer.solana.com/tx/23Zvt1jemoSCDPbGL3WniGppuAYpwekhwcnsr4ZhJE5FhwoLzyfQajBEY1P56ZMRrkxwhTJsVdMXpLVAfVSYXoZ9?cluster=devnet) | Воркер автоматически собрал и сжёг 1; текущий supply 9 999 979,049999 |

Стейкинг здесь **только управляемая оператором демонстрация**: хранилище подписывается локальным ключом оператора, а награда берётся из тестовой казны по формуле с условными 8% годовых. Нет автономного смарт-контракта, аудита безопасности, гарантированной доходности, ценового «пола» или денег. Короткий цикл показал, что комиссия 1% на каждом переводе намного превышает такую награду. Сжигание не встроено в сам перевод: отдельный воркер выполняет его только пока запущен и сейчас просматривает лишь три известных тестовых аккаунта. Повторный запуск без новой комиссии не сжёг ничего.
