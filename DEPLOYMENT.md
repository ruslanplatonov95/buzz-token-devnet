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
