const fs = require('fs');
const { EmbedBuilder } = require('discord.js');

function updatePlayerKills(name, identity) {
    try {
        const playerFiles = fs.readdirSync('./players');
        let playerData = null;
        let playerFile = null;
        
        // Find player file by identity
        for (const file of playerFiles) {
            const data = JSON.parse(fs.readFileSync(`./players/${file}`));
            if (data.identity === identity) {
                playerData = data;
                playerFile = file;
                if (!playerData.kills) playerData.kills = 0;
                playerData.kills++;
                playerData.lastKill = new Date().toISOString();
                fs.writeFileSync(`./players/${file}`, JSON.stringify(playerData, null, 2));
                break;
            }
        }

        // Update server statistics with top killers
        if (playerData) {
            let serverStats = JSON.parse(fs.readFileSync('./server_statistics.json'));
            
            if (!serverStats.topKillers) {
                serverStats.topKillers = [
                    { name: "", kills: 0, lastKill: "" },
                    { name: "", kills: 0, lastKill: "" },
                    { name: "", kills: 0, lastKill: "" }
                ];
            }

            // Create killer entry
            const killerEntry = {
                name: playerData.name,
                kills: playerData.kills,
                lastKill: playerData.lastKill
            };

            // Add killer to top killers if they qualify
            let allKillers = [...serverStats.topKillers, killerEntry];
            allKillers = allKillers.filter(k => k.name !== ""); // Remove empty entries
            
            // Remove duplicate entries for the same player, keeping the latest
            allKillers = allKillers.reduce((acc, current) => {
                const x = acc.find(item => item.name === current.name);
                if (!x) {
                    return acc.concat([current]);
                } else {
                    return acc.map(item => 
                        item.name === current.name && new Date(current.lastKill) > new Date(item.lastKill) 
                            ? current 
                            : item
                    );
                }
            }, []);

            // Sort by kills and take top 3
            allKillers.sort((a, b) => b.kills - a.kills);
            serverStats.topKillers = allKillers.slice(0, 3);

            // If we don't have 3 entries, pad with empty ones
            while (serverStats.topKillers.length < 3) {
                serverStats.topKillers.push({ name: "", kills: 0, lastKill: "" });
            }

            fs.writeFileSync('./server_statistics.json', JSON.stringify(serverStats, null, 2));
        }
    } catch (err) {
        console.error("Error updating player kills:", err);
    }
}

// Update handleLeaderboardCommand to use server statistics
async function handleLeaderboardCommand(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const serverStats = JSON.parse(fs.readFileSync('./server_statistics.json'));
        const topPlayers = serverStats.topKillers.filter(k => k.name !== "");

        if (topPlayers.length === 0) {
            await interaction.editReply({
                content: 'No players with kills found.',
                ephemeral: true
            });
            return;
        }

        // Create embed
        const embed = new EmbedBuilder()
            .setTitle('🏆 Top Killers Leaderboard')
            .setColor('#FFD700')
            .setDescription(
                topPlayers.map((player, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                    const lastKill = player.lastKill ? 
                        new Date(player.lastKill).toLocaleString() : 'Never';
                    return `${medal} **${player.name}** - ${player.kills} kills\n*Last kill: ${lastKill}*`;
                }).join('\n\n')
            )
            .setFooter({ text: 'Stats are updated in real-time' })
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed],
            ephemeral: true
        });
    } catch (error) {
        console.error('Error creating leaderboard:', error);
        await interaction.editReply({
            content: 'Error creating leaderboard.',
            ephemeral: true
        });
    }
}

module.exports = {
    updatePlayerKills,
    handleLeaderboardCommand
};
