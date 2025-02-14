const { REST, Routes } = require('discord.js');
const { token, clientId } = require('./config.json');

// Load command definitions from file(s)
const reforgerstats = require('./commands/reforgerstats-commands');
const commands = [ reforgerstats ]; // Add additional command exports as needed

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
