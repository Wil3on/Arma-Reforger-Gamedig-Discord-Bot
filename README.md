 Install Required Software
Make sure you have the following installed on your system:

Node.js (Recommended version: 18.x or higher)
npm (comes with Node.js)
To check if they’re installed, run:

bash
Copy
Edit
node -v
npm -v

2. Set Up the Project
Create a project folder:

bash
Copy
Edit
mkdir arma-reforger-status-bot
cd arma-reforger-status-bot
Initialize the project:

bash
Copy
Edit
npm init -y
Install required packages: Run the following to install the dependencies:

bash
Copy
Edit
npm install discord.js gamedig
Create a config.json file: Inside the project folder, create a file called config.json with the following structure:

json
Copy
Edit
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
Replace the placeholders with your actual information:

token: Your Discord bot token (from the Discord Developer Portal).
channelId: The ID of the Discord channel where the bot will send status updates.
serverIp: The IP address of your Arma Reforger server.
serverPort: The query port of your server (not the game port; usually specified in server settings).
gamePort: The game port of your server.
gameType: For Arma Reforger, use arma3 as the type.
refreshRate: Time (in seconds) between server status updates.
3. Run the Bot
Start the bot: Use this command to run the bot:

bash
Copy
Edit
node index.js
Verify in Discord: The bot should appear online, and it will send or update a message in the specified channel with the Arma Reforger server status.

4. Debugging and Logs
If the bot doesn’t work as expected, check the console for errors.
Common issues might include:
Invalid token or channel ID.
Server IP/port misconfiguration.
Missing permissions for the bot to send messages.
5. Run the Bot as a Service (Optional)
If you want the bot to run continuously, you can use a process manager like PM2:

bash
Copy
Edit
npm install -g pm2
pm2 start index.js --name "arma-reforger-bot"
pm2 save
pm2 startup
