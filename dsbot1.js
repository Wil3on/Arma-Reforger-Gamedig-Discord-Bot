const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const { GameDig } = require('gamedig');
const config = require('./config.json');
const fs = require('fs');
const SftpClient = require('ssh2-sftp-client');
const winston = require('winston');
const moment = require('moment-timezone');

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

// Add command cooldown management
const cooldowns = new Map();

// Add logger configuration
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            maxFiles: config.logging?.maxFiles || 7 
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log',
            maxFiles: config.logging?.maxFiles || 7
        })
    ]
});

// Update permission check function to handle responses properly
async function checkPermissions(interaction) {
    try {
        // Check channels
        if (config.commands?.allowedChannels && !config.commands.allowedChannels.includes(interaction.channelId)) {
            const allowedChannels = config.commands.allowedChannels
                .map(id => {
                    const channel = interaction.guild.channels.cache.get(id);
                    return channel ? `<#${id}>` : null;
                })
                .filter(name => name !== null);
            
            return {
                allowed: false,
                message: `This command can only be used in these channels:\n${allowedChannels.join('\n')}`
            };
        }

        // Check roles
        if (config.commands?.allowedRoles && config.commands.allowedRoles.length > 0) {
            const hasRole = interaction.member.roles.cache.some(role => 
                config.commands.allowedRoles.includes(role.id)
            );
            
            if (!hasRole) {
                const allowedRoles = config.commands.allowedRoles
                    .map(id => {
                        const role = interaction.guild.roles.cache.get(id);
                        return role ? `<@&${id}>` : null;
                    })
                    .filter(role => role !== null);
                
                return {
                    allowed: false,
                    message: `You need one of these roles to use this command:\n${allowedRoles.join('\n')}`
                };
            }
        }

        return { allowed: true };
    } catch (error) {
        console.error('Error in permission check:', error);
        return {
            allowed: false,
            message: 'There was an error checking permissions. Please try again.'
        };
    }
}

// Update cooldown check function to handle responses properly
function checkCooldown(interaction, command) {
    if (!cooldowns.has(command)) {
        cooldowns.set(command, new Map());
    }

    const timestamps = cooldowns.get(command);
    const cooldownAmount = (config.commands?.cooldown || 30) * 1000;
    
    if (timestamps.has(interaction.user.id)) {
        const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
        
        if (Date.now() < expirationTime) {
            const timeLeft = (expirationTime - Date.now()) / 1000;
            return {
                allowed: false,
                message: `Please wait ${timeLeft.toFixed(1)} more seconds before using this command again.`
            };
        }
    }
    
    timestamps.set(interaction.user.id, Date.now());
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
    return { allowed: true };
}

// Update handleHelpCommand to show new command structure
async function handleHelpCommand(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('Server Status Bot Commands')
        .setColor('#0099ff')
        .setDescription(
            '**Server Commands:**\n' +
            '`/reforgerstats server install` - Initialize server status message\n' +
            '`/reforgerstats server refresh` - Manually refresh server status\n' +
            '`/reforgerstats server help` - Display this help message\n\n' +
            '**Settings Commands:**\n' +
            '`/reforgerstats settings addrole` - Add allowed role\n' +
            '`/reforgerstats settings removerole` - Remove allowed role\n' +
            '`/reforgerstats settings addchannel` - Add allowed channel\n' +
            '`/reforgerstats settings removechannel` - Remove allowed channel\n' +
            '`/reforgerstats settings allowedchannels` - List allowed channels\n' +
            '`/reforgerstats settings allowedroles` - List allowed roles\n' +
            '`/reforgerstats settings restart-bot` - Restart Node.js server\n' +
            '`/reforgerstats settings stop-bot` - Stop the bot process'
        );
    
    await interaction.reply({ 
        embeds: [embed], 
        flags: [1 << 6]
    });
}

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

// Fix 5: Update client.once ready with config validation
client.once('ready', async () => {
    try {
        validateConfig();
        
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
                .setDescription('Loading server information, it may take up to 30 seconds...')
                .setColor('#0099ff');
            
            statusMessage = await channel.send({ embeds: [embed] });
            
            config.messageId = statusMessage.id;
            fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
        }
        
        updateServerStatus();
        setInterval(updateServerStatus, config.refreshRate * 1000);
    } catch (error) {
        console.error('Failed to initialize bot:', error);
        process.exit(1);
    }
});

// Fix 7: Update updateServerStatus with better error handling
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
                    (config.stats_display?.show_kills ? `**Tottal Players Killed** (Per Match): ${statsData.player_killed}\n` : '') +
                    (config.stats_display?.show_last_winner ? `${statsData.last_winner}\n` : '')
                    : '') +
                `\n **Updated:** ${new Date().toLocaleTimeString()} (Update Interval ${config.refreshRate} sec)`
            );
        
        try {
            await statusMessage.edit({ embeds: [embed] });
        } catch (editError) {
            if (editError.code === 10008) {
                console.warn("Status message not found. Sending new message.");
                const channel = await client.channels.fetch(config.channelId);
                statusMessage = await channel.send({ embeds: [embed] });
                config.messageId = statusMessage.id;
                fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
            } else {
                throw editError;
            }
        }

    } catch (error) {
        console.error('Error updating server status:', error);
        await closeSftpConnection(); // Reset SFTP connection on error
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

// Fix 3: Update getStatsData with better connection management
async function getStatsData() {
    if (!config.stats_path || !config.sftp) return null;
    
    try {
        const sftp = await getSftpConnection();
        const data = await sftp.get(config.stats_path);
        const winner = await getLastWinner(sftp);
        const stats = JSON.parse(data.toString());
        
        return {
            fps: Number(stats.fps) || 0,
            uptime_seconds: Number(stats.uptime_seconds) || 0,
            base_captured: Number(stats.events?.serveradmintools_conflict_base_captured) || 0,
            player_killed: Number(stats.events?.serveradmintools_player_killed) || 0,
            last_winner: winner
        };
    } catch (err) {
        console.error("Error retrieving stats file via SFTP:", err);
        await closeSftpConnection(); // Reset connection on error
        return null;
    }
}

// Add these new functions before getStatsData
async function getLatestLogDirectory(sftp) {
    try {
        const baseLogPath = config.baseLogPath;
        const dirs = await sftp.list(baseLogPath);
        const logDirs = dirs
            .filter(entry => entry.type === 'd' && entry.name.startsWith('logs_'))
            .sort((a, b) => b.name.localeCompare(a.name));
        
        // Return the second item (index 1) if it exists, otherwise return the latest (index 0)
        return logDirs.length > 1 ? 
            `${baseLogPath}/${logDirs[1].name}` : 
            (logDirs.length > 0 ? `${baseLogPath}/${logDirs[0].name}` : null);
    } catch (err) {
        console.error("Error getting latest log directory:", err);
        return null;
    }
}

async function getLastWinner(sftp) {
    try {
        const latestLogDir = await getLatestLogDirectory(sftp);
        if (!latestLogDir) return "Last Round Winner: No data";

        const consolePath = `${latestLogDir}/console.log`;
        const data = await sftp.get(consolePath);
        const content = data.toString();

        const winnerMatch = content.match(/serveradmintools_game_ended.*?winner:\s*(\w+)/);
        return winnerMatch ? `Last Round Winner: ${winnerMatch[1]}` : "Last Round Winner: No data";
    } catch (err) {
        console.error("Error reading console log:", err);
        return "Last Round Winner: No data";
    }
}

// Fix 4: Add error handling for config validation
function validateConfig() {
    const required = ['token', 'channelId', 'serverIp', 'serverPort', 'gamePort'];
    const missing = required.filter(key => !config[key]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required config values: ${missing.join(', ')}`);
    }
}

// Fix 2: Improve SFTP connection management
let sftpClient = null;

async function getSftpConnection() {
    if (!sftpClient) {
        sftpClient = new SftpClient();
        await sftpClient.connect(config.sftp);
    }
    return sftpClient;
}

async function closeSftpConnection() {
    if (sftpClient) {
        await sftpClient.end();
        sftpClient = null;
    }
}

// Fix 8: Improve messageCreate handler with error handling
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        if (interaction.commandName === 'reforgerstats') {
            // Get subcommand group and subcommand from the new structure
            const group = interaction.options.getSubcommandGroup();
            const subcommand = interaction.options.getSubcommand();

            // Check permissions and cooldown
            const permCheck = await checkPermissions(interaction);
            if (!permCheck.allowed) {
                await interaction.reply({ content: permCheck.message, flags: [1 << 6] });
                return;
            }
            const cooldownCheck = checkCooldown(interaction, interaction.commandName);
            if (!cooldownCheck.allowed) {
                await interaction.reply({ content: cooldownCheck.message, flags: [1 << 6] });
                return;
            }

            if (group === 'server') {
                switch (subcommand) {
                    case 'install':
                        await handleInitCommand(interaction);
                        break;
                    case 'refresh':
                        await handleRefreshCommand(interaction);
                        break;
                    case 'help':
                        await handleHelpCommand(interaction);
                        break;
                }
            } else if (group === 'settings') {
                switch (subcommand) {
                    case 'addrole':
                        await handleAddRole(interaction);
                        break;
                    case 'removerole':
                        await handleRemoveRole(interaction);
                        break;
                    case 'addchannel':
                        await handleAddChannel(interaction);
                        break;
                    case 'removechannel':
                        await handleRemoveChannel(interaction);
                        break;
                    case 'allowedchannels':
                        await handleAllowedChannels(interaction);
                        break;
                    case 'allowedroles':
                        await handleAllowedRoles(interaction);
                        break;
                    case 'restart-bot':
                        await handleRestartServer(interaction);
                        break;
                    case 'stop-bot':
                        await handleStopBot(interaction);
                        break;
                }
            }
        }
    } catch (error) {
        console.error('Error handling command:', error);
        const errorDetails = error && error.message ? error.message : 'No additional details';
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `An error occurred while processing the command. Details: ${errorDetails}`,
                flags: [1 << 6]
            });
        }
    }
});

// Add new stop-bot command handler
async function handleStopBot(interaction) {
    const confirm = interaction.options.getBoolean("confirm");
    if (!confirm) {
        await interaction.reply({
            content: "Stop bot cancelled. Confirmation not provided.",
            ephemeral: true
        });
        return;
    }
    await interaction.reply("Stopping bot...");
    // Clean up resources if necessary
    await closeSftpConnection();
    client.destroy();
    // Allow the reply to be sent before exiting.
    setTimeout(() => process.exit(0), 1000);
}

// Add new restart command handler
async function handleRestartServer(interaction) {
    const confirm = interaction.options.getBoolean("confirm");
    if (!confirm) {
        await interaction.reply({
            content: "Restart cancelled. Confirmation not provided.",
            ephemeral: true
        });
        return;
    }
    await interaction.reply("Restarting server...");
    const { spawn } = require('child_process');
    // Spawn a new Node.js process running dsbot1.js in detached mode
    const child = spawn(process.execPath, ['dsbot1.js'], {
        detached: true,
        stdio: 'ignore'
    });
    child.unref();
    // Allow the reply to be sent before exiting.
    setTimeout(() => process.exit(0), 1000);
}

// Fix 1: Add cleanup for countdown interval on process exit
process.on('SIGINT', () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    process.exit(0);
});

// Fix 6: Add cleanup on process exit
process.on('exit', async () => {
    await closeSftpConnection();
});

// Add this new function for refresh countdown
async function refreshCountdown(message, seconds) {
    const reply = await message.reply(`🔄 Refreshing server status in ${seconds} seconds...`);
    
    for (let i = seconds - 1; i > 0; i--) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await reply.edit(`🔄 Refreshing server status in ${i} seconds...`);
    }
    
    await reply.edit('🔄 Refreshing now...');
    await updateServerStatus();
    
    // Wait 10 seconds before cleaning up messages
    await new Promise(resolve => setTimeout(resolve, 10000));
    await reply.delete().catch(console.error);
    await message.delete().catch(console.error);
}

// Add the new command handlers
async function handleInitCommand(interaction) {
    const confirm = interaction.options.getBoolean("confirm");
    if (config.messageId && !confirm) {
        const messageLink = `https://discord.com/channels/${interaction.guild.id}/${config.channelId}/${config.messageId}`;
        await interaction.reply({ 
            content: `A status message already exists ([View Message](${messageLink})) with ID (${config.messageId}). To install a new one, run the command with the confirm flag set to true.`,
            ephemeral: true 
        });
        return;
    }
    
    await interaction.deferReply();
    
    const embed = new EmbedBuilder()
        .setTitle('Arma Reforger Server Status')
        .setDescription('Loading server information, it may take up to 30 seconds...')
        .setColor('#0099ff');
        
    statusMessage = await interaction.channel.send({ embeds: [embed] });
    
    config.messageId = statusMessage.id;
    config.channelId = interaction.channelId;
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    
    await updateServerStatus();
    await interaction.deleteReply();
}

async function handleRefreshCommand(interaction) {
    await interaction.deferReply();
    console.log('\nManual refresh requested');
    console.log('------------------------');
    
    await interaction.editReply('🔄 Refreshing server status in 5 seconds...');
    
    for (let i = 4; i > 0; i--) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await interaction.editReply(`🔄 Refreshing server status in ${i} seconds...`);
    }
    
    await interaction.editReply('🔄 Refreshing now...');
    await updateServerStatus();
    
    setTimeout(async () => {
        await interaction.deleteReply().catch(console.error);
    }, 10000);
}

// Add reconnection handling
client.on('disconnect', () => {
    logger.warn('Bot disconnected from Discord');
});

client.on('reconnecting', () => {
    logger.info('Bot attempting to reconnect...');
});

client.on('error', error => {
    logger.error('Discord client error:', error);
});

client.login(config.token);

// Add handler for allowed roles command
async function handleAllowedRoles(interaction) {
    const allowedRoles = config.commands.allowedRoles || [];
    const rolesText = allowedRoles.map(id => `<@&${id}>`).join(', ');
    await interaction.reply({ content: `Allowed roles: ${rolesText}`, flags: [1 << 6] });
}

// Optionally, add handler for allowed channels if not defined
async function handleAllowedChannels(interaction) {
    const allowedChannels = config.commands.allowedChannels || [];
    const channelsText = allowedChannels.map(id => `<#${id}>`).join(', ');
    await interaction.reply({ content: `Allowed channels: ${channelsText}`, flags: [1 << 6] });
}