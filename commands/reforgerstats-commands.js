// reforgerstats-commands.js
module.exports = {
    name: 'reforgerstats',
    description: 'Main bot command with server and settings subcommands',
    options: [
        {
            name: 'server',
            description: 'Server commands',
            type: 2, // SUB_COMMAND GROUP
            options: [
                {
                    name: 'install',
                    description: 'Initialize server status message',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'confirm',
                            description: 'Confirm to install a new status message if one already exists',
                            type: 5, // BOOLEAN
                            required: false
                        }
                    ]
                },
                {
                    name: 'refresh',
                    description: 'Manually refresh server status',
                    type: 1 // SUB_COMMAND
                },
                {
                    name: 'help',
                    description: 'Show available commands',
                    type: 1 // SUB_COMMAND
                },
                {
                    name: 'players',
                    description: 'Show currently connected players',
                    type: 1 // SUB_COMMAND
                },
                {
                    name: 'leaderboard',
                    description: 'Show top players by kills',
                    type: 1 // SUB_COMMAND
                }
            ]
        },
        {
            name: 'settings',
            description: 'Manage bot settings',
            type: 2, // SUB_COMMAND GROUP
            options: [
                {
                    name: 'addrole',
                    description: 'Add a role that can use bot commands',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'role',
                            description: 'The role to add',
                            type: 8, // ROLE
                            required: true
                        }
                    ]
                },
                {
                    name: 'removerole',
                    description: 'Remove a role from using bot commands',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'role',
                            description: 'The role to remove',
                            type: 8, // ROLE
                            required: true
                        }
                    ]
                },
                {
                    name: 'addchannel',
                    description: 'Add a channel where bot commands can be used',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'channel',
                            description: 'The channel to add',
                            type: 7, // CHANNEL
                            required: true
                        }
                    ]
                },
                {
                    name: 'removechannel',
                    description: 'Remove a channel from using bot commands',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'channel',
                            description: 'The channel to remove',
                            type: 7, // CHANNEL,
                            required: true
                        }
                    ]
                },
                {
                    name: 'allowedchannels',
                    description: 'List all allowed channels',
                    type: 1 // SUB_COMMAND
                },
                {
                    name: 'allowedroles',
                    description: 'List all allowed roles',
                    type: 1 // SUB_COMMAND
                },
                {
                    name: 'restart-bot',
                    description: 'Restart Node.js server after confirmation',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'confirm',
                            description: 'Confirm to restart server',
                            type: 5, // BOOLEAN
                            required: true
                        }
                    ]
                },
                {
                    name: 'stop-bot',
                    description: 'Stop the bot process gracefully after confirmation',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'confirm',
                            description: 'Confirm to stop the bot process',
                            type: 5, // BOOLEAN,
                            required: true
                        }
                    ]
                }
            ]
        }
    ]
};
