const fs = require('fs');
const { getLatestLogDirectoryForMem } = require('./utils');

async function parsePlayerInfo(sftp, playerIdentity) {
    try {
        // Create players directory if it doesn't exist
        if (!fs.existsSync('./players')) {
            fs.mkdirSync('./players');
        }

        const latestLogDir = await getLatestLogDirectoryForMem(sftp);
        if (!latestLogDir) return;

        const consolePath = `${latestLogDir}/console.log`;
        const data = await sftp.get(consolePath);
        const content = data.toString();
        const lines = content.split('\n');

        // Create maps to store player data
        const identities = new Map(); // name -> identity
        const playerKills = new Map(); // identity -> kills

        // Add filter for specific player identity
        playerKills.set(playerIdentity, 0);

        // First pass: collect identities and initial kill counts
        for (const line of lines) {
            if (line.includes('serveradmintools_player_joined')) {
                const playerMatch = line.match(/player: ([^,]+), identity: ([a-f0-9-]+)/);
                if (playerMatch) {
                    const [_, name, identity] = playerMatch;
                    identities.set(name, identity);
                    if (!playerKills.has(identity)) {
                        playerKills.set(identity, 0);
                    }
                }
            } else if (line.includes('serveradmintools_player_killed')) {
                const killerMatch = line.match(/instigator: ([^,]+)/);
                const identityMatch = line.match(/instigator_identity: ([a-f0-9-]+)/);
                if (killerMatch && identityMatch && 
                    killerMatch[1] !== 'AI' && 
                    killerMatch[1] !== 'world') {
                    const identity = identityMatch[1];
                    const currentKills = playerKills.get(identity) || 0;
                    playerKills.set(identity, currentKills + 1);
                }
            }
        }

        let currentPlayer = {};
        let currentTimestamp = '';

        // Second pass: update player files with collected data
        for (const line of lines) {
            const timestampMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})/);
            if (timestampMatch) {
                const timestamp = timestampMatch[1];
                
                if (currentTimestamp && timestamp !== currentTimestamp) {
                    if (currentPlayer['BE GUID'] && currentPlayer.name && currentPlayer.ip) {
                        // Add identity and kills data
                        if (identities.has(currentPlayer.name)) {
                            currentPlayer.identity = identities.get(currentPlayer.name);
                            currentPlayer.kills = playerKills.get(currentPlayer.identity) || 0;
                            currentPlayer.lastKill = currentPlayer.kills > 0 ? new Date().toISOString() : null;
                        } else {
                            currentPlayer.kills = 0;
                            currentPlayer.lastKill = null;
                        }
                        const playerPath = `./players/${currentPlayer['BE GUID']}.json`;
                        fs.writeFileSync(playerPath, JSON.stringify(currentPlayer, null, 2));
                    }
                    currentPlayer = {};
                }
                currentTimestamp = timestamp;

                if (line.includes('BattlEye Server: Adding player')) {
                    const nameMatch = line.match(/name='([^']+)'/);
                    if (nameMatch) {
                        currentPlayer.name = nameMatch[1];
                    }
                } else if (line.includes('connected')) {
                    const ipMatch = line.match(/\(([^)]+)\)/);
                    if (ipMatch) {
                        currentPlayer.ip = ipMatch[1].split(':')[0];
                    }
                } else if (line.includes('BE GUID:')) {
                    const guidMatch = line.match(/BE GUID: ([a-f0-9]+)/);
                    if (guidMatch) {
                        currentPlayer['BE GUID'] = guidMatch[1];
                        // Update player file if we have all required info
                        if (currentPlayer.name && currentPlayer.ip) {
                            if (identities.has(currentPlayer.name)) {
                                currentPlayer.identity = identities.get(currentPlayer.name);
                                currentPlayer.kills = playerKills.get(currentPlayer.identity) || 0;
                                currentPlayer.lastKill = currentPlayer.kills > 0 ? new Date().toISOString() : null;
                            } else {
                                currentPlayer.kills = 0;
                                currentPlayer.lastKill = null;
                            }
                            const playerPath = `./players/${currentPlayer['BE GUID']}.json`;
                            fs.writeFileSync(playerPath, JSON.stringify(currentPlayer, null, 2));
                        }
                    }
                }
            }
        }

        return {
            kills: playerKills.get(playerIdentity) || 0,
            lastKill: playerKills.get(playerIdentity) > 0 ? new Date().toISOString() : null
        };
    } catch (err) {
        console.error("Error parsing player info:", err);
        return null;
    }
}

module.exports = {
    parsePlayerInfo,
    getLatestLogDirectoryForMem
};
