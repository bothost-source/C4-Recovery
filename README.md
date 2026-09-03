# C4 Recovery Bot

WhatsApp & Instagram Ban Checker Telegram Bot

## Setup

1. `npm install`
2. Fill `.env` with your values
3. `npm start`

## Render Deployment

- Set environment variables in Render dashboard
- Use `npm start` as start command
- Free tier: SQLite persists on disk

## Config

Edit `config.js` or set env vars:
- `BOT_TOKEN` - From @BotFather
- `OWNER_ID` - Your numeric Telegram ID
- `OWNER_USERNAME` - Without @
- `WELCOME_IMAGE_URL` - Your welcome image

## Features

- Sticky ban reasons (consistent per number)
- Premium-gated checking
- Owner panel with stats, broadcast, maintenance
- Message editing (no spam)
- All text in Telegram blockquotes
- English & Brazilian Portuguese
