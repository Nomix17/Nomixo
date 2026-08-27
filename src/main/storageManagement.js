import fs from "fs";
import path from "path";
import { readFile, writeFile, unlink} from 'fs/promises';
import { Paths } from "./FilesManager.js";
import { log } from "./debugging.js";
import { downloadImage } from "./utils.js";

async function loadJsonFile(filePath) {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content);
}

export async function loadDownloadStorage() {
  try {
    return await loadJsonFile(Paths.downloadLibraryFilePath);
  } catch(err) {
    if(err.code === "ENOENT") return { downloads : [] };
    log.error("Failed to load Download Storage:", err);
  }
}

export async function loadLibraryStorage() {
  try {
    return await loadJsonFile(Paths.libraryFilePath);
  } catch(err) {
    if(err.code === "ENOENT") return { media : [] };
    log.error("Failed to load Library Storage:", err); 
  }
}

export async function getDownloadEntry(torrentId) {
  const LibraryInfo = await loadDownloadStorage();
  if (LibraryInfo.downloads.length) {
    if (torrentId == null) return LibraryInfo.downloads;
    let targetLibraryInfo = LibraryInfo.downloads.filter(
      element => element.torrentId === torrentId
    );
    if (targetLibraryInfo.length) return targetLibraryInfo?.[0];
  }
  return undefined;
}

export async function getLibraryEntry(targetIdentification) {
  const LibraryInfo = await loadLibraryStorage();
  if (LibraryInfo.media.length) {
    if (targetIdentification == null) return LibraryInfo.media;
    let targetLibraryInfo = LibraryInfo.media.filter(
      element =>
        element.MediaId === targetIdentification.MediaId &&
        element.MediaType === targetIdentification.MediaType
    );
    if (targetLibraryInfo.length) return targetLibraryInfo;
  }
  return undefined;
}

export async function overwriteStorageFile(filePath, newData) {
  try {
    await writeFile(filePath, JSON.stringify(newData));
  } catch (err) {
    log.error(err);
  }
}

const fileLocks = new Map();
function withFileLock(filePath, task) {
  const previous = fileLocks.get(filePath) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(task);
  fileLocks.set(filePath, run.catch(() => {}));
  return run;
}

export async function insertNewDownloadEntry(torrentEntry, Status = "LOADING") {
  const posterDownloadPath = torrentEntry?.downloadPath
    ? path.join(torrentEntry.downloadPath, "POSTERS")
    : Paths.postersDirPath;

  const bgImageUrl = torrentEntry?.bgImageUrl;
  const posterUrl = torrentEntry?.posterUrl;
  const bgImagePath = bgImageUrl ? path.join(posterDownloadPath, bgImageUrl.split("/").pop()) : "";
  const posterPath = posterUrl ? path.join(posterDownloadPath, posterUrl.split("/").pop()) : "";

  const newEntry = {
    ...torrentEntry,
    posterPath: posterPath ?? "undefined",
    bgImagePath: bgImagePath ?? "undefined",
    Status,
    StatusUpdateTime: Date.now(),
  };

  const wasInserted = await withFileLock(Paths.downloadLibraryFilePath, async () => {
    const downloadLib = await loadDownloadStorage();

    const existingIndex = downloadLib.downloads.findIndex(
      item => item.torrentId === torrentEntry.torrentId
    );

    if (existingIndex !== -1) return false;

    downloadImage(posterDownloadPath, torrentEntry?.bgImageUrl);
    downloadImage(posterDownloadPath, torrentEntry?.posterUrl);

    downloadLib.downloads.push(newEntry);
    await overwriteStorageFile(Paths.downloadLibraryFilePath, downloadLib);
    log.info("Creating Download Library Entry Point for: " + torrentEntry.torrentId);
    return true;
  });

  if (!wasInserted) {
    log.info("Editing Download Status of: " + torrentEntry.torrentId);
    await editDownloadStorageEntry([torrentEntry.torrentId], "Status", Status);
  }
  return wasInserted;
}

export async function saveDownloadProgress(torrentEntry, downloadedBytes, totalSize) {
  await withFileLock(Paths.downloadLibraryFilePath, async () => {
    const downloadLib = await loadDownloadStorage();

    const existingIndex = downloadLib.downloads.findIndex(
      item => item.torrentId === torrentEntry.torrentId
    );

    if (existingIndex !== -1) {
      downloadLib.downloads[existingIndex]["Downloaded"] = downloadedBytes;
      downloadLib.downloads[existingIndex]["typeOfSave"] =
        torrentEntry.Status === "DONE" ? "Download-Complete" : "Download";
      downloadLib.downloads[existingIndex]["Total"] = totalSize;

      if (torrentEntry.Status === "DONE")
        downloadLib.downloads[existingIndex]["Status"] = "DONE";

      await overwriteStorageFile(Paths.downloadLibraryFilePath, downloadLib);
    }
  });
}

export async function editDownloadStorageEntry(torrentsIds, key, value) {
  await withFileLock(Paths.downloadLibraryFilePath, async () => {
    const downloadLibraryInfo = await loadDownloadStorage();
    for (let torrentId of torrentsIds) {
      for (let index = 0; index < downloadLibraryInfo.downloads.length; index++) {
        if (downloadLibraryInfo.downloads[index].torrentId === torrentId) {
          if (key === "Status")
            downloadLibraryInfo.downloads[index]["StatusUpdateTime"] = Date.now();
          downloadLibraryInfo.downloads[index][key] = value;
          break;
        }
      }
    }
    await overwriteStorageFile(Paths.downloadLibraryFilePath, downloadLibraryInfo);
  });
}

export async function removeDownloadStorageEntry(torrentId) {
  await withFileLock(Paths.downloadLibraryFilePath, async () => {
    const downloadLib = await loadDownloadStorage();
    downloadLib.downloads = downloadLib.downloads.filter(
      element => element.torrentId !== torrentId
    );
    await overwriteStorageFile(Paths.downloadLibraryFilePath, downloadLib);
  });
}

export async function removeLibraryStorageEntry(torrentId) {
  await withFileLock(Paths.libraryFilePath, async () => {
    const LibraryInfo = await loadLibraryStorage();
    LibraryInfo.media = LibraryInfo.media.filter(
      element => element.torrentId !== torrentId
    );
    await overwriteStorageFile(Paths.libraryFilePath, LibraryInfo);
  });
}

export async function markMediaDownloadsAsPaused() {
  const wholeDownloadLibrary = await loadDownloadStorage();
  const torrentsIds = wholeDownloadLibrary.downloads
    .filter(torrentElement => torrentElement?.Status !== "DONE")
    .map(torrent => torrent.torrentId);

  await editDownloadStorageEntry(torrentsIds,"Status","PAUSED");
}

export async function readSearchHistory() {
  try {
    const data = await readFile(Paths.searchHistoryCacheFile, "utf-8");
    if (data.trim() === "") throw new Error("Empty Search History");
    return JSON.parse(data)?.history || [];
  } catch (error) {
    log.error("Failed to load search history: ", error.message);
    return [];
  }
}

export async function writeSearchHistory(history) {
  try {
    await writeFile(
      Paths.searchHistoryCacheFile,
      JSON.stringify({ history }, null, 2),
      "utf-8"
    );
  } catch (error) {
    log.error("Failed to save search history: ", error.message);
  }
}
