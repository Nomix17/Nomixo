import fs from "fs";
import path from "path";
import { readFile, writeFile, unlink} from 'fs/promises';
import { Paths } from "./FilesManager.js";
import { log } from "./debugging.js";
import { downloadImage } from "./utils.js";

function loadJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function loadDownloadStorage() {
  try {
    return loadJsonFile(Paths.downloadLibraryFilePath);
  } catch {
    return { downloads: [] };
  }
}

export function loadLibraryStorage() {
  try {
    return loadJsonFile(Paths.libraryFilePath);
  } catch {
    return { media: [] };
  }
}

export async function getDownloadEntry(torrentId) {
  const LibraryInfo = await loadDownloadStorage();
  if (LibraryInfo.downloads.length) {
    if (torrentId == null) return LibraryInfo.downloads;
    let targetLibraryInfo = LibraryInfo.downloads.filter(
      element => element.torrentId === torrentId
    );
    if (targetLibraryInfo.length) return targetLibraryInfo;
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

export function overwriteStorageFile(filePath, newData) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(newData));
  } catch (err) {
    log.error(err);
  }
}

export async function insertNewDownloadEntry(torrentEntry, Status = "Loading") {
  const downloadLib = await loadDownloadStorage();

  const existingIndex = downloadLib.downloads.findIndex(
    item => item.torrentId === torrentEntry.torrentId
  );

  if (existingIndex === -1) {
    const posterDownloadPath = torrentEntry?.downloadPath
      ? path.join(torrentEntry.downloadPath, "POSTERS")
      : Paths.postersDirPath;

    const bgImageUrl = torrentEntry?.bgImageUrl;
    const posterUrl = torrentEntry?.posterUrl;
    const bgImagePath = bgImageUrl ? path.join(posterDownloadPath, bgImageUrl.split("/").pop()) : "";
    const posterPath = posterUrl ? path.join(posterDownloadPath, posterUrl.split("/").pop()) : "";
    downloadImage(posterDownloadPath, torrentEntry?.bgImageUrl);
    downloadImage(posterDownloadPath, torrentEntry?.posterUrl);

    const newEntry = {
      ...torrentEntry,
      posterPath: posterPath ?? "undefined",
      bgImagePath: bgImagePath ?? "undefined",
      Status,
      StatusUpdateTime: Date.now(),
    };
    downloadLib.downloads.push(newEntry);

    await overwriteStorageFile(Paths.downloadLibraryFilePath, downloadLib);
    log.info("Creating Download Library Entry Point for: " + torrentEntry.torrentId);
    return true;
  } else {
    log.info("Editing Download Status of: " + torrentEntry.torrentId);
    await editDownloadStorageEntry([torrentEntry.torrentId], "Status", Status);
    return false;
  }
}

export async function saveDownloadProgress(torrentEntry, downloadedBytes, totalSize) {
  const downloadLib = await loadDownloadStorage();

  const existingIndex = downloadLib.downloads.findIndex(
    item => item.torrentId === torrentEntry.torrentId
  );

  if (existingIndex !== -1) {
    downloadLib.downloads[existingIndex]["Downloaded"] = downloadedBytes;
    downloadLib.downloads[existingIndex]["typeOfSave"] =
      torrentEntry.Status === "Done" ? "Download-Complete" : "Download";
    downloadLib.downloads[existingIndex]["Total"] = totalSize;

    if (torrentEntry.Status === "Done")
      downloadLib.downloads[existingIndex]["Status"] = "Done";

    await overwriteStorageFile(Paths.downloadLibraryFilePath, downloadLib);
  }
}

export async function editDownloadStorageEntry(torrentsIds, key, value) {
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
}

export async function removeDownloadStorageEntry(torrentId) {
  const downloadLib = await loadDownloadStorage();
  downloadLib.downloads = downloadLib.downloads.filter(
    element => element.torrentId !== torrentId
  );
  overwriteStorageFile(Paths.downloadLibraryFilePath, downloadLib);
}

export async function removeLibraryStorageEntry(torrentId) {
  const LibraryInfo = await loadLibraryStorage();
  LibraryInfo.media = LibraryInfo.media.filter(
    element => element.torrentId !== torrentId
  );
  overwriteStorageFile(Paths.libraryFilePath, LibraryInfo);
}

export async function markMediaDownloadsAsPaused() {
  const wholeDownloadLibrary = await loadDownloadStorage();
  const torrentsIds = wholeDownloadLibrary.downloads
    .filter(torrentElement => torrentElement?.Status.toLowerCase() !== "done")
    .map(torrent => torrent.torrentId);

  await editDownloadStorageEntry(torrentsIds,"Status","Paused");
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
