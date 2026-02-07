import { Daytona } from '@daytonaio/sdk';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

const SANDBOX_ROOT = '/home/daytona/workspace';

let daytona = null;
let sandbox = null;
let localDir = null;

// File utilities
async function getLocalFiles(dir, base = dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getLocalFiles(fullPath, base));
    } else {
      files.push({
        local: fullPath,
        relative: fullPath.slice(base.length + 1)
      });
    }
  }
  return files;
}

async function ensureFolder(path) {
  try {
    await sandbox.fs.createFolder(path, '755');
  } catch { /* folder may exist */ }
}

// Sync operations
async function syncToSandbox() {
  if (!existsSync(localDir)) return;
  
  const files = await getLocalFiles(localDir);
  if (files.length === 0) return;
  
  console.log(`[Sync] Uploading ${files.length} files to sandbox...`);
  
  for (const file of files) {
    const content = await readFile(file.local, 'utf-8');
    const sandboxPath = `${SANDBOX_ROOT}/${file.relative}`;
    const parentDir = dirname(sandboxPath);
    
    await ensureFolder(parentDir);
    
    const fileObj = new File([content], file.relative.split('/').pop());
    await sandbox.fs.uploadFile(sandboxPath, fileObj);
  }
  
  console.log('[Sync] Upload complete');
}

async function syncFromSandbox() {
  const syncFiles = async (remotePath, localBase) => {
    const files = await sandbox.fs.listFiles(remotePath);
    if (!files?.length) return;
    
    for (const file of files) {
      const sandboxPath = `${remotePath}/${file.name}`;
      const localPath = join(localBase, file.name);
      
      if (file.isDir) {
        await mkdir(localPath, { recursive: true });
        await syncFiles(sandboxPath, localPath);
      } else {
        try {
          const data = await sandbox.fs.downloadFile(sandboxPath);
          const content = typeof data.text === 'function' 
            ? await data.text() 
            : data.toString();
          await mkdir(dirname(localPath), { recursive: true });
          await writeFile(localPath, content, 'utf-8');
        } catch (err) {
          console.error(`[Sync] Failed: ${file.name}: ${err.message}`);
        }
      }
    }
  };
  
  try {
    console.log('[Sync] Downloading files from sandbox...');
    await syncFiles(SANDBOX_ROOT, localDir);
    console.log('[Sync] Download complete');
  } catch (err) {
    console.error('[Sync] Failed:', err.message);
  }
}

// Public API
export async function initSandbox(apiKey, localSyncDir) {
  daytona = new Daytona({ apiKey, target: "eu" });
  localDir = localSyncDir;
  
  await mkdir(localDir, { recursive: true });
  
  console.log('[Daytona] Creating sandbox...');
  sandbox = await daytona.create();
  console.log(`[Daytona] Sandbox ready: ${sandbox.id}`);
  
  await ensureFolder(SANDBOX_ROOT);
  await syncToSandbox();
  
  return sandbox;
}

export async function destroySandbox() {
  if (!sandbox) return;
  
  await syncFromSandbox();
  console.log('[Daytona] Destroying sandbox...');
  await sandbox.delete();
  console.log('[Daytona] Sandbox destroyed');
}

export function getSandbox() {
  return sandbox;
}

export async function uploadFile(relativePath, content) {
  const sandboxPath = `${SANDBOX_ROOT}/${relativePath}`;
  await ensureFolder(dirname(sandboxPath));
  const fileObj = new File([content], relativePath.split('/').pop());
  await sandbox.fs.uploadFile(sandboxPath, fileObj);
  return sandboxPath;
}

export async function downloadFile(path) {
  const fullPath = path.startsWith(SANDBOX_ROOT) 
    ? path 
    : `${SANDBOX_ROOT}/${path.replace(/^\.?\//, '')}`;
  
  const data = await sandbox.fs.downloadFile(fullPath);
  return typeof data.text === 'function' ? await data.text() : data.toString();
}

export async function deleteFile(path) {
  try {
    await sandbox.fs.deleteFile(path);
  } catch { /* file may not exist */ }
}

export async function executeCommand(command, cwd = SANDBOX_ROOT) {
  return sandbox.process.executeCommand(command, cwd);
}

export { SANDBOX_ROOT };
