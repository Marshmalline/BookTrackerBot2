const fs = require('fs');
const path = require('path');

const DATA_FILE = 'userData.json';
const BACKUP_DIR = 'backups';

// Create the backups directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
}

// Generate a timestamp for the backup file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(BACKUP_DIR, `userData_${timestamp}.json`);

// Copy the userData.json file to the backup file
fs.copyFileSync(DATA_FILE, backupFile);

console.log(`Backup created: ${backupFile}`);