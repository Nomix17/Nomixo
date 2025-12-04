import {createWriteStream,existsSync,mkdirSync,readdirSync} from "fs";
import {get} from "https";
import {join} from "path";

async function downloadMultiple(subDirectory,subsObjects){
  console.log("----------------------------------------------------------------------------------------------------");
  let tasks = subsObjects.map(obj => downloadSub(subDirectory,subsObjects,obj.url,obj.language)
    .then(res=>({status:"success",file:res}))
    .catch(rej=>({status:"failed",error:rej}))
  )

  let results = await Promise.all(tasks);
  console.log("----------------------------------------------------------------------------------------------------");
  return results;
}

function downloadSub(subDirectory, subsObjects, subUrl, language){
  return new Promise((res,rej)=>{
    let downloadDirectory = subDirectory;
    
    if(!existsSync(downloadDirectory))
      mkdirSync(downloadDirectory,{recursive:true});
    
    let fileExtension = new URL(subUrl).searchParams.get("format");
    let fileNumber = 0;
    for(let obj of subsObjects){
      if(obj.language == language){
        if(obj.url == subUrl){
          break;
        }else{
          fileNumber++;
        }
      }
    }

    let fileName = `${language} ${fileNumber}.${fileExtension}`;
    let fileFullPath = join(downloadDirectory,fileName);

    const file = createWriteStream(fileFullPath);
    get(subUrl,responce => {
      responce.pipe(file);
      file.on("finish",()=>{
        file.close();
        console.log(`Done Downloading ${fileFullPath}`);
        res(fileFullPath);
      });
    }).on("error",err=>{
      rej("failed to download "+ fileFullPath);
    });
  });
}

export default downloadMultiple;
