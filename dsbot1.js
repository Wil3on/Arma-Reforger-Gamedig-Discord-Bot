const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const { GameDig } = require('gamedig');
const config = require('./config.json');
const fs = require('fs');
const SftpClient = require('ssh2-sftp-client');

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
let countdownInterval = null;
let lastServerData = null;  // Add this to store the latest server data

// Add this helper function after imports
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days} Day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes} Min`);
    if (secs > 0) parts.push(`${secs} Sec`);
    
    return parts.join(', ') || '0 Sec';
}

// Update countdown function
function startCountdown(seconds, serverState, statsData) {
    if (countdownInterval) clearInterval(countdownInterval);
    let remainingTime = seconds;
    lastServerData = { serverState, statsData };
    
    const displayData = () => {
        console.clear();
        // Display server info
        console.log('\nServer Status:');
        console.log('==============');
        console.log(`Next refresh in: ${remainingTime} seconds\n`);

        if (lastServerData.serverState) {
            console.log('Server Data:');
            console.log('-----------');
            console.log(`Server Name: ${lastServerData.serverState.name}`);
            console.log(`Players: ${lastServerData.serverState.numplayers}/${lastServerData.serverState.maxplayers}`);
            console.log(`Map: ${lastServerData.serverState.map}`);
        }
        
        if (lastServerData.statsData) {
            console.log('\nStats Data:');
            console.log('-----------');
            console.log(`FPS: ${lastServerData.statsData.fps}`);
            console.log(`Server Uptime: ${formatUptime(lastServerData.statsData.uptime_seconds)}`);
            console.log(`Bases Captured: ${lastServerData.statsData.base_captured}`);
            console.log(`Players Killed: ${lastServerData.statsData.player_killed}`);
        }
    };

    displayData();
    countdownInterval = setInterval(() => {
        remainingTime--;
        if (remainingTime < 0) {
            clearInterval(countdownInterval);
        } else {
            displayData();
        }
    }, 1000);
}

function updateBotActivity(playerCount, maxPlayers) {
    if (client.user && (config.enableActivityStatus !== false)) {
        client.user.setActivity({
            name: `S1: ${playerCount}/${maxPlayers}`,
            type: ActivityType.Listening
        });
    } else if (client.user) {
        client.user.setActivity(null);
    }
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const channel = await client.channels.fetch(config.channelId);
    
    try {
        if (config.messageId) {
            statusMessage = await channel.messages.fetch(config.messageId);
        }
    } catch (error) {
        console.log('Could not fetch existing message, will create new one');
    }

    if (!statusMessage) {
        const embed = new EmbedBuilder()
            .setTitle('Arma Reforger Server Status')
            .setDescription('Loading server information...')
            .setColor('#0099ff');
        
        statusMessage = await channel.send({ embeds: [embed] });
        
        config.messageId = statusMessage.id;
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    }
    
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

        const statsData = await getStatsData();
        
        // Update countdown with both state and stats data
        startCountdown(config.refreshRate, state, statsData);

        console.log('\nParsed Server Data:');
        console.log('-------------------');
        console.log(`Server Name: ${state.name}`);
        console.log(`Players: ${state.numplayers}/${state.maxplayers}`);
        console.log(`Map: ${state.map}`);
        
        // Get stats data once and use it for both logging and embed
        if (statsData) {
            console.log('\nStats Data:');
            console.log('-----------');
            console.log(`FPS: ${statsData.fps}`);
            console.log(`Server Uptime: ${formatUptime(statsData.uptime_seconds)}`);
            console.log(`Bases Captured: ${statsData.base_captured}`);
            console.log(`Players Killed: ${statsData.player_killed}`);
        }

        const playerCount = state.numplayers || 0;
        const maxPlayers = state.maxplayers || 0;

        updateBotActivity(playerCount, maxPlayers);

        if (!serverStartTime) {
            serverStartTime = new Date();
        }

        const uptime = serverStartTime ? Math.floor((new Date() - serverStartTime) / 1000) : 0;
        const uptimeHours = Math.floor(uptime / 3600);
        const uptimeMinutes = Math.floor((uptime % 3600) / 60);
        const uptimeSeconds = uptime % 60;
        const uptimeString = `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`;

        // Modify the embed creation to check display options
        const embed = new EmbedBuilder()
            .setTitle(state.name || 'Arma Reforger Server')
            .setColor('#00ff00')
            .setDescription(
                `**Status:** Online\n` +
                `**Players:** ${playerCount}/${maxPlayers}\n` +
                `**Map:** ${state.map || 'Unknown'}\n` +
                `**Server IP:** ${config.serverIp}:${config.gamePort}\n` +
                `**Uptime:** ${uptimeString}\n` +
                (statsData ? 
                    `### 📊 Server Stats\n` +
                    (config.stats_display?.show_fps ? `**FPS:** ${statsData.fps}\n` : '') +
                    (config.stats_display?.show_uptime ? `**Match Duration:** ${formatUptime(statsData.uptime_seconds)}\n` : '') +
                    (config.stats_display?.show_bases ? `**Base Captured:** ${statsData.base_captured}\n` : '') +
                    (config.stats_display?.show_kills ? `**Tottal Players Killed** (Per Match): ${statsData.player_killed}\n` : '')
                    : '') +
                `\n **Updated:** ${new Date().toLocaleTimeString()} (Update Interval ${config.refreshRate} sec)`
            );

        await statusMessage.edit({ embeds: [embed] });

    } catch (error) {
        console.error('Error updating server status:', error);
        // Start countdown with null data on error
        startCountdown(config.refreshRate, null, null);
        const errorEmbed = new EmbedBuilder()
            .setTitle('Arma Reforger Server')
            .setColor('#ff0000')
            .setDescription(
                `**Status:** Offline\n` +
                `**Players:** 0/0\n` +
                `**Map:** N/A\n` +
                `**Server IP:** ${config.serverIp}:${config.gamePort}\n` +
                `**Uptime:** N/A\n` +
                `**Updated:** ${new Date().toLocaleTimeString()} (Update Interval ${config.refreshRate} sec)`
            );
        
        await statusMessage.edit({ embeds: [errorEmbed] });

        serverStartTime = null;
        updateBotActivity(0, 0);
    }
}

// Add back the getStatsData function
async function getStatsData() {
    if (!config.stats_path || !config.sftp) return null;
    const sftp = new SftpClient();
    try {
        await sftp.connect(config.sftp);
        const data = await sftp.get(config.stats_path);
        await sftp.end();
        const stats = JSON.parse(data.toString());
        return {
            fps: stats.fps,
            uptime_seconds: stats.uptime_seconds,
            base_captured: stats.events.serveradmintools_conflict_base_captured,
            player_killed: stats.events.serveradmintools_player_killed
        };
    } catch (err) {
        console.error("Error retrieving stats file via SFTP:", err);
        return null;
    }
}

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!armareforgera1')) return;

    const channel = message.channel;
    
    const embed = new EmbedBuilder()
        .setTitle('Arma Reforger Server Status')
        .setDescription('Loading server information...')
        .setColor('#0099ff');
    
    statusMessage = await channel.send({ embeds: [embed] });
    
    config.messageId = statusMessage.id;
    config.channelId = channel.id;
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    
    await updateServerStatus();
    
    await message.delete().catch(console.error);
});

client.login(config.token);
