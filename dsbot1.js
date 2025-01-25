const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { GameDig } = require('gamedig');
const config = require('./config.json');
const fs = require('fs');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});
const gamedig = new GameDig();

let statusMessage = null;
let serverStartTime = null;

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const channel = await client.channels.fetch(config.channelId);
    
    try {
        if (config.messageId) {
            // Try to fetch existing message
            statusMessage = await channel.messages.fetch(config.messageId);
        }
    } catch (error) {
        console.log('Could not fetch existing message, will create new one');
    }

    if (!statusMessage) {
        // Create new status message if none exists
        const embed = new EmbedBuilder()
            .setTitle('Arma Reforger Server Status')
            .setDescription('Loading server information...')
            .setColor('#0099ff');
        
        statusMessage = await channel.send({ embeds: [embed] });
        
        // Save message ID to config
        config.messageId = statusMessage.id;
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    }
    
    // Update server status using configured refresh rate
    updateServerStatus();
    setInterval(updateServerStatus, config.refreshRate * 1000);
});

async function updateServerStatus() {
    if (!statusMessage) return;

    try {
        const state = await gamedig.query({
            type: config.gameType,
            host: config.serverIp,
            port: config.serverPort,
            attemptTimeout: 10000
        });

        console.log('Full server response:', JSON.stringify(state, null, 2)); // Detailed debug log

        // Use numplayers for accurate player count
        const playerCount = state.numplayers || 0;
        const maxPlayers = state.maxplayers || 0;

        // Update server start time if server is online
        if (!serverStartTime) {
            serverStartTime = new Date();
        }

        // Calculate uptime
        const uptime = serverStartTime ? Math.floor((new Date() - serverStartTime) / 1000) : 0;
        const uptimeHours = Math.floor(uptime / 3600);
        const uptimeMinutes = Math.floor((uptime % 3600) / 60);
        const uptimeSeconds = uptime % 60;
        const uptimeString = `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`;

        const embed = new EmbedBuilder()
            .setTitle(state.name || 'Arma Reforger Server')
            .setColor('#00ff00')
            .setDescription(
                `**Status:** Online\n` +
                `**Players:** ${playerCount}**/**${maxPlayers}\n` +
                `**Map:** ${state.map || 'Unknown'}\n` +
                `**Server IP:** ${config.serverIp}:${config.gamePort}\n` +
                `**Uptime:** ${uptimeString}\n` +
                `**Updated:** ${new Date().toLocaleTimeString()}`
            );

        await statusMessage.edit({ embeds: [embed] });

    } catch (error) {
        console.error('Error updating server status:', error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('Arma Reforger Server')
            .setColor('#ff0000')
            .setDescription(
                `**Status:** Offline\n` +
                `**Players:** 0**/**0\n` +
                `**Map:** N/A\n` +
                `**Server IP:** ${config.serverIp}:${config.gamePort}\n` +
                `**Uptime:** N/A\n` +
                `**Updated:** ${new Date().toLocaleTimeString()}`
            );
        
        await statusMessage.edit({ embeds: [errorEmbed] });

        // Reset server start time if server goes offline
        serverStartTime = null;
    }
}

// Replace the interactionCreate with messageCreate
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!armareforgera1')) return;

    const channel = message.channel;
    
    // Create new status message
    const embed = new EmbedBuilder()
        .setTitle('Arma Reforger Server Status')
        .setDescription('Loading server information...')
        .setColor('#0099ff');
    
    statusMessage = await channel.send({ embeds: [embed] });
    
    // Save message ID to config
    config.messageId = statusMessage.id;
    config.channelId = channel.id;
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    
    // Update status immediately
    await updateServerStatus();
    
    // Delete the command message
    await message.delete().catch(console.error);
});

client.login(config.token);