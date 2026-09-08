import path from "path";
import { randomUUID } from "crypto";
import { readFile, writeFile, rename, unlink } from 'fs/promises';
import { Paths } from "./FilesManager.js";
import { log } from "./debugging.js";
import { downloadImage, pathExists } from "./utils.js";

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
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, JSON.stringify(newData, null, 2), "utf-8");
    await rename(tempPath, filePath);

  } catch (err) {
    log.error("Failed to overwrite storage file:", err);
    try { await unlink(tempPath); } catch {}
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
    await editDownloadStorageEntry(torrentEntry.torrentId, "Status", Status);
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

export async function editDownloadStorageEntry(torrentId, key, value) {
  await withFileLock(Paths.downloadLibraryFilePath, async () => {
    const downloadLibraryInfo = await loadDownloadStorage();
    for (let index = 0; index < downloadLibraryInfo.downloads.length; index++) {
      if (downloadLibraryInfo.downloads[index].torrentId === torrentId) {
        if (key === "Status")
          downloadLibraryInfo.downloads[index]["StatusUpdateTime"] = Date.now();
        downloadLibraryInfo.downloads[index][key] = value;
        break;
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

  for(const torrentId of torrentsIds)
    await editDownloadStorageEntry(torrentId,"Status","PAUSED");
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

export async function loadSettings() {
  try {
    const data = await readFile(Paths.SettingsFilePath, "utf-8");
    if (data.trim() === "" || !("TurnOnSubsByDefaultInternal" in JSON.parse(data)))
      throw new Error("empty Settings File");

    const JData = JSON.parse(data);
    if (JData?.MpvExecPath == null || JData?.MpvExecPath.trim() === "")
      JData.MpvExecPath = await findMpvExecPath();

    JData.LanguagesToDownload ??= { English: { displayName: "English", iso639: "en" } };
    JData.DownloadAllSubtitles ??= true;

    return JData;
  } catch (err) {
    log.error(err.message);
    return {
      PageZoomFactor: 1,
      TurnOnSubsByDefaultInternal: true,
      SubFontSizeInternal: 16,
      SubFontFamilyInternal: "Montserrat",
      SubColorInternal: "#ffffff",
      SubBackgroundColorInternal: "#000000",
      SubBackgroundOpacityLevelInternal: 0,
      DefaultDownloadPath: Paths.__downloads,
      rememberDownloadLocationByDefault: true,
      DownloadSubtitlesByDefault: true,
      LanguagesToDownload: {
        English: { displayName: "English", iso639: "en" }
      },
      DownloadAllSubtitles: true,
      MpvExecPath: await findMpvExecPath(),
    };
  }
}

export async function findMpvExecPath() {
  const fromPath = await resolveMpvExecFromPATH();
  if (fromPath) return fromPath;
  const knownPaths =
    os.platform() === "win32"
      ? [
          path.join(process.resourcesPath, "mpvBinary", "mpv.exe"),
          "C:\\Program Files\\mpv\\mpv.exe",
          "C:\\Program Files (x86)\\mpv\\mpv.exe",
          path.join(os.homedir(), "AppData", "Local", "Programs", "mpv", "mpv.exe"),
          path.join(os.homedir(), "scoop", "apps", "mpv", "current", "mpv.exe"),
          "C:\\tools\\mpv\\mpv.exe",
          path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Packages", "mpv.exe"),
        ]
      : [
          path.join(process.resourcesPath, "mpvBinary", "mpv"),
          "/usr/bin/mpv",
          "/usr/local/bin/mpv",
          "/opt/homebrew/bin/mpv",
          "/snap/bin/mpv",
          "/flatpak/exports/bin/mpv",
          path.join(os.homedir(), ".local/bin/mpv"),
        ];
  for (const candidate of knownPaths) {
    if (await pathExists(candidate)) {
      log.info(`Found mpv at: ${candidate}`);
      return candidate;
    }
  }
  log.warn("Mpv executable path not found anywhere");
  return null;
}

async function resolveMpvExecFromPATH() {
  const isWindows = os.platform() === "win32";
  const whichCommand = isWindows ? "where" : "which";

  return new Promise((resolve) => {
    const proc = spawn(whichCommand, ["mpv"], { encoding: "utf8" });
    let stdout = "";
    proc.stdout.on("data", (data) => (stdout += data.toString()));
    proc.on("close", (code) => {
      if (code !== 0 || !stdout.trim()) {
        log.warn("mpv not found in PATH");
        return resolve(null);
      }
      const result = stdout.trim().split("\n")[0].trim();
      log.info(`Found mpv at: ${result}`);
      resolve(result);
    });
    proc.on("error", () => {
      log.warn("mpv not found in PATH");
      resolve(null);
    });
  });
}
