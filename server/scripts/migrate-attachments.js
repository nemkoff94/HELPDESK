const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', 'helpdesk.db');
const uploadsDir = path.join(__dirname, '..', 'uploads', 'attachments');

if (!fs.existsSync(dbPath)) {
  console.error('Database not found at', dbPath);
  process.exit(1);
}

if (!fs.existsSync(uploadsDir)) {
  console.error('Uploads directory not found at', uploadsDir);
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);

const transliterate = (str) => {
  const map = {
    А:'A', Б:'B', В:'V', Г:'G', Д:'D', Е:'E', Ё:'E', Ж:'Zh', З:'Z', И:'I', Й:'Y', К:'K', Л:'L', М:'M', Н:'N', О:'O', П:'P', Р:'R', С:'S', Т:'T', У:'U', Ф:'F', Х:'Kh', Ц:'Ts', Ч:'Ch', Ш:'Sh', Щ:'Shch', Ъ:'', Ы:'Y', Ь:'', Э:'E', Ю:'Yu', Я:'Ya',
    а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i', й:'y', к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f', х:'kh', ц:'ts', ч:'ch', ш:'sh', щ:'shch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya'
  };
  return str.split('').map(c => map[c] || c).join('');
};

const slugify = (str) => {
  return transliterate(str)
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const backupDir = path.join(__dirname, '..', 'uploads', `attachments_backup_${Date.now()}`);
fs.mkdirSync(backupDir, { recursive: true });

console.log('Starting migration of attachments...');
console.log('Database:', dbPath);
console.log('Uploads dir:', uploadsDir);
console.log('Backup dir:', backupDir);

db.serialize(() => {
  db.all('SELECT * FROM attachments', (err, rows) => {
    if (err) {
      console.error('Failed to read attachments:', err);
      process.exit(1);
    }

    let changed = 0;

    for (const row of rows) {
      const filename = row.filename || '';
      const originalName = row.original_name || '';
      // if filename is ascii-only and doesn't contain Cyrillic, skip
      if (/^[\x00-\x7F]+$/.test(filename)) continue;

      // Compute source path from row.path
      const relPath = row.path || '';
      const filePath = path.join(__dirname, '..', relPath.startsWith('/') ? relPath.slice(1) : relPath);
      if (!fs.existsSync(filePath)) {
        console.warn('File not found, skipping:', filePath);
        continue;
      }

      // Prepare new safe filename
      const ext = path.extname(filename) || path.extname(originalName) || '';
      const nameBase = originalName ? path.basename(originalName, ext) : path.basename(filename, ext);
      const safeBase = slugify(nameBase) || 'attachment';
      let newFilename = `${safeBase}_${uuidv4()}${ext}`;
      let newPath = path.join(uploadsDir, newFilename);
      // avoid collision
      let suffix = 1;
      while (fs.existsSync(newPath)) {
        newFilename = `${safeBase}_${uuidv4()}_${suffix}${ext}`;
        newPath = path.join(uploadsDir, newFilename);
        suffix++;
      }

      // Copy original to backup
      try {
        fs.copyFileSync(filePath, path.join(backupDir, path.basename(filePath)));
      } catch (e) {
        console.warn('Failed to backup file:', filePath, e);
      }

      // Move (rename) file
      try {
        fs.renameSync(filePath, newPath);
      } catch (e) {
        console.error('Failed to rename file:', filePath, '->', newPath, e);
        continue;
      }

      const newRel = path.posix.join('/uploads/attachments', newFilename);
      db.run('UPDATE attachments SET filename = ?, path = ? WHERE id = ?', [newFilename, newRel, row.id], (err) => {
        if (err) console.error('Failed to update DB for attachment', row.id, err);
      });

      console.log(`Migrated attachment id=${row.id} : ${path.basename(filePath)} -> ${newFilename}`);
      changed++;
    }

    console.log(`Migration complete. ${changed} attachments migrated. Backup created at ${backupDir}`);
    db.close();
  });
});
