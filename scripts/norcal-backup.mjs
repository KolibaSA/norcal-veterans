import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { verifyConfig, TARGET, wranglerQuery } from './norcal-hq-agent.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const tables = ['records','grants','audit','attachments','submission_limits','request_runs','request_entries','hq_agent_health','record_revisions'];

export function verifySQLBackup(sql, { upgradeCheck = false } = {}) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(sql);
    const migrationNames = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'").get() ?
      new Set(db.prepare('SELECT name FROM d1_migrations').all().map(row => row.name)) : new Set();
    const existingTables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    const upgrades = [];
    if (upgradeCheck) {
      for (const file of readdirSync(resolve(root,'migrations/legacy')).filter(name=>name.endsWith('.sql')).sort()) {
        const exists = file.startsWith('0001_') ? existingTables.has('records') :
          file.startsWith('0002_') ? existingTables.has('request_runs') : file.startsWith('0003_') ? existingTables.has('record_revisions') : migrationNames.has(file);
        if (!exists) { db.exec(readFileSync(resolve(root,'migrations/legacy',file),'utf8')); upgrades.push(file); }
      }
    }
    const integrity = db.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new Error('Backup integrity check failed.');
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Backup foreign key check failed.');
    const names = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
    for (const name of tables.slice(0,5)) if (!names.has(name)) throw new Error('Backup is missing an active HQ table: '+name);
    if (upgradeCheck) for (const name of tables) if (!names.has(name)) throw new Error('Upgrade is missing table: '+name);
    const counts = Object.fromEntries(tables.filter(name=>names.has(name)).map(name=>[name,db.prepare('SELECT COUNT(*) AS count FROM '+name).get().count]));
    const duplicates = db.prepare("SELECT id FROM records WHERE version<1 OR NOT json_valid(payload)").all();
    if (duplicates.length) throw new Error('Backup contains malformed record versions or payloads.');
    return { integrity:'ok', foreign_keys:'ok', counts, upgrades_checked:upgrades };
  } finally { db.close(); }
}

export function createVerifiedBackup({ upgradeCheck = false } = {}) {
  const config = JSON.parse(readFileSync(resolve(root,'wrangler.jsonc'),'utf8'));
  verifyConfig(config);
  const directory = resolve(root,'.data/backups');
  mkdirSync(directory,{recursive:true});
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const output = resolve(directory,'norcal-'+stamp+'.sql');
  try {
    execFileSync(process.execPath,[resolve(root,'node_modules/wrangler/bin/wrangler.js'),'d1','export',TARGET.databaseName,
      '--config',resolve(root,'wrangler.jsonc'),'--remote','--output',output],{
      cwd:root,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:1024*1024,
      env:{...process.env,NODE_USE_SYSTEM_CA:'1',WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']
    });
  } catch { throw new Error('D1 export failed. No backup was reported as verified. Check the Cloudflare connection.'); }
  const bytes=readFileSync(output), verified=verifySQLBackup(bytes.toString('utf8'),{upgradeCheck});
  const report={status:'verified',created_at:new Date().toISOString(),database:TARGET.databaseName,sql_file:output,
    sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,...verified};
  writeFileSync(output+'.verification.json',JSON.stringify(report,null,2)+'\n');
  return report;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try {
    const args=process.argv.slice(2);
    const fileIndex=args.indexOf('--verify-file');
    if(fileIndex<0||!args[fileIndex+1])throw new Error('Use --verify-file PATH [--check-upgrade] [--remote-check]. This command does not export production data.');
    const allowed=args.filter((_,index)=>index!==fileIndex&&index!==fileIndex+1);
    if(allowed.some(arg=>!['--check-upgrade','--remote-check'].includes(arg)))throw new Error('Unknown recovery-check option.');
    const backupPath=resolve(root,args[fileIndex+1]);
    const verified=verifySQLBackup(readFileSync(backupPath,'utf8'),{upgradeCheck:allowed.includes('--check-upgrade')});
    let remote;
    if(allowed.includes('--remote-check')){
      verifyConfig(JSON.parse(readFileSync(resolve(root,'wrangler.jsonc'),'utf8')));
      const result=wranglerQuery('PRAGMA quick_check; PRAGMA foreign_key_check; SELECT name FROM d1_migrations ORDER BY name;');
      if(result[0].results.length!==1||Object.values(result[0].results[0])[0]!=='ok'||result[1].results.length)throw new Error('Live database integrity check failed.');
      remote={integrity:'ok',foreign_keys:'ok',migrations:result[2].results.map(row=>row.name)};
    }
    const report={status:'verified',checked_at:new Date().toISOString(),existing_backup:backupPath,...verified,...(remote?{remote}:{}),note:'Restored an existing backup; no new private production export was created.'};
    mkdirSync(resolve(root,'.data/recovery-checks'),{recursive:true});
    writeFileSync(resolve(root,'.data/recovery-checks/latest.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  }catch(error){console.error(JSON.stringify({status:'failed',error:error.message}));process.exitCode=1;}
}
