import {createWriteStream,existsSync,mkdirSync,unlinkSync} from "fs";
import {get} from "https";
import {join} from "path";

async function downloadMultiple(subDirectory,subsObjects){
  console.log("----------------------------------------------------------------------------------------------------");
  let tasks = subsObjects.map(obj =>
    downloadSub(subDirectory,subsObjects,obj)
      .then(res=>({status:"success",file:res}))
      .catch(err=>({status:"failed",error:err}))
  );
  let results = await Promise.all(tasks);
  console.log("----------------------------------------------------------------------------------------------------");
  return results;
}

function downloadSub(downloadDirectory,subsObjects,SubObj){
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
    for(let obj of subsObjects){
      if(obj.language === SubObj.language){
        if(obj.url === SubObj.url) break;
        fileNumber++;
      }
    }

    let fileName = `${SubObj.display ?? SubObj.language}-${fileNumber}.${fileExtension}`;
    let fileFullPath = join(downloadDirectory,fileName);

    if(existsSync(fileFullPath)){
      console.log(`Skip: ${fileFullPath}`);
      return res(fileFullPath);
    }

    const file = createWriteStream(fileFullPath);

    const request = get(SubObj.url,response=>{
      if(response.statusCode < 200 || response.statusCode >= 300){
        response.resume();
        file.destroy();
        if(existsSync(fileFullPath)) unlinkSync(fileFullPath);
        console.error(`Failed to download ${fileFullPath}`);
        return rej(new Error("download failed "+fileFullPath));
      }

      response.pipe(file);
      file.on("finish",()=>{
        console.log(`Done Downloading ${fileFullPath}`);
        res(fileFullPath);
      });
    });

    request.on("error",err=>{
      file.destroy();
      if(existsSync(fileFullPath)) unlinkSync(fileFullPath);
      console.error(`Failed to download ${fileFullPath}`);
      rej(err);
    });

    file.on("error",err=>{
      if(existsSync(fileFullPath)) unlinkSync(fileFullPath);
      console.error(`Failed to download ${fileFullPath}`);
      rej(err);
    });
  });
}

export default downloadMultiple;
