# Arma Reforger Discord Status Bot

## Overview
This Discord bot provides real-time status updates for an Arma Reforger game server, displaying current player count, server status, and other key information in a specified Discord channel.

## Prerequisites

### Required Software
- Node.js (Recommended version: 18.x or higher)
- npm (comes with Node.js)

### Verify Installation
Check your Node.js and npm versions:
```bash
node -v
npm -v
```

## Installation and Setup

### 1. Create a Project Folder
```bash
mkdir arma-reforger-status-bot
cd arma-reforger-status-bot
```

### 2. Install
```bash
npm init -y
npm install discord.js gamedig
```

This will install the following key dependencies:
- `discord.js`: Discord bot API
- `gamedig`: Server query library

### 3. Configuration

#### Create `config.json`
Create a `config.json` file in the project root with the following structure:

```json
{
    "token": "YOUR_DISCORD_BOT_TOKEN",
    "channelId": "YOUR_CHANNEL_ID",
    "messageId": null,
    "serverIp": "YOUR_SERVER_IP",
    "serverPort": YOUR_SERVER_PORT,
    "gamePort": YOUR_GAME_PORT,
    "gameType": "arma3",
    "refreshRate": 60
}
```

#### Configuration Parameters
- `token`: Discord bot token from the [Discord Developer Portal](https://discord.com/developers/applications)
- `channelId`: Discord channel ID for status updates
- `serverIp`: Arma Reforger server IP address
- `serverPort`: Server query port
- `gamePort`: Game server port
- `gameType`: Use `arma3` for Arma Reforger
- `refreshRate`: Update interval in seconds

### 4. Running the Bot

#### Development Mode
```bash
node index.js
```

#### Production Mode (Recommended)
Using PM2 for continuous operation:
```bash
npm install -g pm2
pm2 start index.js --name "arma-reforger-bot"
pm2 save
pm2 startup
```

## Troubleshooting

### Common Issues
- Invalid Discord bot token
- Incorrect server IP or port configuration
- Missing bot permissions in the Discord channel

### Debugging
- Check console logs for detailed error messages
- Verify all configuration parameters
- Ensure bot has necessary Discord permissions

## Contributing
Contributions are welcome! Please submit pull requests or open issues on the GitHub repository.

## License
[Specify your license here]

## Disclaimer
This bot is a community project and is not officially affiliated with Arma Reforger or Bohemia Interactive.
