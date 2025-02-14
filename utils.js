const config = require('./config.json');

async function getLatestLogDirectoryForMem(sftp) {
    try {
        const baseLogPath = config.baseLogPath;
        const dirs = await sftp.list(baseLogPath);
        const logDirs = dirs
            .filter(entry => entry.type === 'd' && entry.name.startsWith('logs_'))
            .sort((a, b) => b.name.localeCompare(a.name));
        
        return logDirs.length > 0 ? `${baseLogPath}/${logDirs[0].name}` : null;
    } catch (err) {
        console.error("Error getting latest log directory:", err);
        return null;
    }
}

async function getLatestLogDirectory(sftp) {
    try {
        const baseLogPath = config.baseLogPath;
        const dirs = await sftp.list(baseLogPath);
        const logDirs = dirs
            .filter(entry => entry.type === 'd' && entry.name.startsWith('logs_'))
            .sort((a, b) => b.name.localeCompare(a.name));
        
        return logDirs.length > 1 ? 
            `${baseLogPath}/${logDirs[1].name}` : 
            (logDirs.length > 0 ? `${baseLogPath}/${logDirs[0].name}` : null);
    } catch (err) {
        console.error("Error getting latest log directory:", err);
        return null;
    }
}

module.exports = {
    getLatestLogDirectoryForMem,
    getLatestLogDirectory
};
