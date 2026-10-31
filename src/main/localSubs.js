import path from "path";
import { readdir } from "fs/promises";
import { log } from "./debugging.js";
import languageDict from "./languageDict.js";
import {
  generateUniqueId,
  pathExists
} from "./utils.js";

export async function loadSubsFromSubDir(mediaInfo) {
  const torrentId = mediaInfo?.torrentId ?? generateUniqueId(
    `${mediaInfo.IMDB_ID}` +
    `-${mediaInfo.episodeNumber ?? "undefined"}` + 
    `-${mediaInfo.seasonNumber ?? "undefined"}`+ 
    `-${mediaInfo.fileName}`+ 
    `-${mediaInfo.MagnetLink}`
  );

  const subsDirectory = path.join(mediaInfo.downloadPath, `SUBS_${torrentId}`);

  try {
    if (!(await pathExists(subsDirectory)))
      throw new Error(`Subtitles aren't downloaded in: ${subsDirectory}`);
    const subFileNames = await readdir(subsDirectory);
    return subFileNames.map((subFileName) => {
      const displayName = subFileName.split("-")?.[0] ?? subFileName;
      return {
        url: path.join(subsDirectory, subFileName),
        display: displayName,
        languageCode: languageDict[displayName]?.iso639 ?? displayName,
        type: "local",
      };
    });
  } catch (err) {
    log.error(err.message);
    return [];
  }
}

export async function loadSubsFromVideoDirectory(videoPath) {
  const videoParentsPath = path.dirname(videoPath);
  try {
    const subFileNames = await readdir(videoParentsPath);
    return subFileNames.flatMap((subFileName) => {
      const fileExtension = path.extname(subFileName);
      if (fileExtension === ".srt" || fileExtension === ".vtt") {
        return [{
          url: path.join(videoParentsPath, subFileName),
          display: "Built In",
          languageCode: "built-in",
          languageName: subFileName.split(fileExtension)[0],
          type: "local",
        }];
      }
      return [];
    });
  } catch (err) {
    log.warn(err);
    return [];
  }
}
