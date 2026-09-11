import crypto from 'crypto';
import path from 'path';
import {log} from "./debugging.js";
import { access, readdir, mkdir, writeFile, stat } from 'fs/promises';

export function generateUniqueId(seed) {
  const hash = crypto.createHash('sha256');
  hash.update(seed);
  return hash.digest('hex');
}

export function normaliseFileName(fileName) {
  if (fileName) return fileName.replace(/[+\s]+/g, ' ').trim().toLowerCase();
  return "";
}

export async function findFile(dir, filename) {
  try {
    await access(dir);
  } catch {
    return null;
  }

  const filesPathsHashMap = {};
  const files = await readdir(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const fileStat = await stat(fullPath);

    if (fileStat.isDirectory()) {
      const result = await findFile(fullPath, filename);
      if (result) return result;
    } else if (file === filename) {
      return fullPath;
    }

    filesPathsHashMap[normaliseFileName(file)] = fullPath;
  }

  return filesPathsHashMap[normaliseFileName(filename)] ?? null;
}

export function sanitizeUrl(urlString) {
  const u = new URL(encodeURI(urlString));
  u.pathname = u.pathname.replace(/\/{2,}/g, "/");
  return u.toString();
}

export function sanitizeThemeFileName(fileName) {
  const name = fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/^\.+/, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);

  if (!name) {
    throw new Error('Invalid file name: empty after sanitization');
  }

  return name;
}

export function sanitizeFilename(filename, replacement = '-') {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, replacement)
    .replace(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i, 
      (_, name, rest) => `${replacement}${name}${rest}`
    )
    .trim()
    .replace(/[. ]+$/, '')
    || 'untitled';
}

export async function sendSystemNotification({
  title = "Notification", body = "",
  icon = null, onClick = null,
  silent = false
} = {}) {
  const { app, Notification } = await import('electron');
  const showNotification = () => {
    const notification = new Notification({ title, body, icon, silent });
    if (onClick) notification.on("click", onClick);
    notification.show();
  };
  if (app.isReady()) showNotification();
  else app.whenReady().then(showNotification);
}

export function formatSize(bytes) {
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${(bytes / (1024 ** 2)).toFixed(2)} MB`;
}

export function truncate(text, max = 40) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export async function downloadImage(downloadDir, posterUrl) {
  try {
    await mkdir(downloadDir, { recursive: true });
    const controller = new AbortController();
    const res = await fetch(posterUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) throw new Error('Empty file');
    const file = path.join(downloadDir, path.basename(new URL(posterUrl).pathname));
    await writeFile(file, buffer);
    return file;
  } catch (err) {
    log.error(`Failed to download ${posterUrl}:`, err.message);
    return null;
  }
}

export async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
