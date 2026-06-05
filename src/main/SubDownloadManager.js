import {createWriteStream, existsSync, mkdirSync, unlinkSync} from "fs";
import {log} from "./debugging.js";
import {get} from "https";
import {join} from "path";

class SubDownloadManager {
  static async downloadSubs(subsObjects, torrentId, TorrentDownloadDir) {
    // Download subtitles
    if (subsObjects.length == 0)
      return false;
    const subDownloadDir = join(TorrentDownloadDir, `SUBS_${torrentId}`);
    mkdirSync(subDownloadDir, { recursive: true });
    const downloadRes = await this.downloadMultipleSubs(subDownloadDir, subsObjects);
    const numberOfSuccessfulDownloads = downloadRes.filter(res => res.status === "success")?.length;
    return numberOfSuccessfulDownloads != 0;
  }

  static async downloadMultipleSubs(subDirectory,subsObjects) {
    console.log("----------------------------------------------------------------------------------------------------");
    const tasks = subsObjects.map(obj =>
      this.downloadSub(subDirectory,subsObjects,obj)
        .then(res=>({status:"success",file:res}))
        .catch(err=>({status:"failed",error:err}))
    );
    const results = await Promise.all(tasks);
    console.log("----------------------------------------------------------------------------------------------------");
    return results;
  }

  static downloadSub(downloadDirectory,subsObjects,SubObj) {
    return new Promise((res,rej)=>{
      if(!existsSync(downloadDirectory))
        mkdirSync(downloadDirectory,{recursive:true});

      let fileExtension;
      try{
        fileExtension = SubObj?.format ?? new URL(SubObj.url).searchParams.get("format") ?? "vtt";
      }catch{
        fileExtension = "vtt";
      }

      let fileNumber = 0;
      for(const obj of subsObjects){
        if(obj.language === SubObj.language){
          if(obj.url === SubObj.url) break;
          fileNumber++;
        }
      }

      const languageName = new Intl.DisplayNames(['en'],{type:'language'}).of(SubObj?.language) ?? SubObj.display ?? SubObj.language;
      const fileName = `${languageName}-${fileNumber}.${fileExtension}`;
      const fileFullPath = join(downloadDirectory,fileName);

      if(existsSync(fileFullPath)){
        log.info(`Skip: ${fileFullPath}`);
        return res(fileFullPath);
      }

      const file = createWriteStream(fileFullPath);

      const request = get(SubObj.url,response=>{
        if(response.statusCode < 200 || response.statusCode >= 300){
          response.resume();
          file.destroy();
          if(existsSync(fileFullPath)) unlinkSync(fileFullPath);
          log.error(`Failed to download ${fileFullPath}`);
          return rej(new Error("download failed "+fileFullPath));
        }

        response.pipe(file);
        file.on("finish",()=>{
          log.success(`Done Downloading ${fileFullPath}`);
          res(fileFullPath);
        });
      });

      request.on("error",err=>{
        file.destroy();
        if(existsSync(fileFullPath)) unlinkSync(fileFullPath);
        log.error(`Failed to download ${fileFullPath}`);
        rej(err);
      });

      file.on("error",err=>{
        if(existsSync(fileFullPath)) unlinkSync(fileFullPath);
        log.error(`Failed to download ${fileFullPath}`);
        rej(err);
      });
    });
  }
}

export default SubDownloadManager;
