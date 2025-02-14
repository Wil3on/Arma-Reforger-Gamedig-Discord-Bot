const fs = require('fs');
const { parsePlayerInfo } = require('./playerParser');
const { getLatestLogDirectoryForMem } = require('./utils');

async function updateAllPlayersStats(sftp) {
    try {
        if (!fs.existsSync('./players')) {
            fs.mkdirSync('./players');
        }

        const playerFiles = fs.readdirSync('./players');
        const updatedStats = [];

        for (const file of playerFiles) {
            const playerData = JSON.parse(fs.readFileSync(`./players/${file}`));
            if (playerData.identity) {
                const stats = await parsePlayerInfo(sftp, playerData.identity);
                if (stats) {
                    // Update player file with new stats
                    playerData.kills = stats.kills;
                    playerData.lastKill = stats.lastKill;
                    playerData.lastUpdated = new Date().toISOString();
                    fs.writeFileSync(`./players/${file}`, JSON.stringify(playerData, null, 2));

                    // Add to updated stats array for leaderboard
                    updatedStats.push({
                        name: playerData.name,
                        kills: stats.kills,
                        lastKill: stats.lastKill,
                        lastUpdated: playerData.lastUpdated
                    });
                }
            }
        }

        // Update server statistics with top players
        if (updatedStats.length > 0) {
            const serverStats = JSON.parse(fs.readFileSync('./server_statistics.json'));
            
            // Sort by kills
            updatedStats.sort((a, b) => b.kills - a.kills);
            serverStats.topKillers = updatedStats.slice(0, 3).map(player => ({
                name: player.name,
                kills: player.kills,
                lastKill: player.lastKill,
                lastUpdated: player.lastUpdated
            }));

            fs.writeFileSync('./server_statistics.json', JSON.stringify(serverStats, null, 2));
        }

        return updatedStats;
    } catch (err) {
        console.error("Error updating player stats:", err);
        return [];
    }
}

module.exports = {
    updateAllPlayersStats
};
