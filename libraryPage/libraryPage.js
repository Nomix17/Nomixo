let RightmiddleDiv = document.getElementById("div-middle-right");
let SelectMediaType = document.getElementById("select-type");
let SavedMedia = document.getElementById("div-SavedMedia")
let searchInput = document.getElementById("input-searchForMovie");
let globalLoadingGif = document.getElementById("div-globlaLoadingGif");

SelectMediaType.value = "all";
addSmoothTransition();
setTimeout(()=>{try{globalLoadingGif.style.opacity = "1"}catch(err){console.log(err)}},100);

function fetchMediaData(apiKey,wholeLibraryInformation){
  wholeLibraryInformation.forEach(mediaEntryPoint =>{
    let MediaId = mediaEntryPoint.MediaId;
    let MediaType = mediaEntryPoint.MediaType;
    if(SelectMediaType.value == MediaType || SelectMediaType.value == "all"){
      let searchQuery = `https://api.themoviedb.org/3/${MediaType}/${MediaId}?api_key=${apiKey}`;

      fetch(searchQuery)
        .then(res=>res.json())
        .then(data => {
          if(data.status_code == 7) throw new Error("We’re having trouble loading data</br>Please make sure your Authentication Key is valide!");
          globalLoadingGif.remove();
          SavedMedia.appendChild(createMediaElement(data,MediaType));
        })
        .catch(err=>{
          err.message = (err.message == "Failed to fetch") ? "We’re having trouble loading data</br>Please Check your connection and refresh!":err.message;
          setTimeout(()=>{
            RightmiddleDiv.innerHTML ="";
            let WarningElement = DisplayWarningOrErrorForUser(err.message);
            WarningElement.style.paddingBottom = "1000px;";
            RightmiddleDiv.appendChild(WarningElement);
            globalLoadingGif.remove();
            RightmiddleDiv.style.opacity = 1;
          },800);
        });
    }
  });
}

function createMediaElement(mediaData, ThisMediaType){
      let Id = "Unknown";
      let Title = "Unknown";
      let Adult = "Unknown";
      let PosterImage = "Unknown";
      let MediaType = "Unknown";

      if(mediaData.hasOwnProperty("id")) Id = mediaData["id"];
      
      if(mediaData.hasOwnProperty("title")) Title = mediaData["title"];
      else Title = mediaData["name"];

      if(mediaData.hasOwnProperty("adult")) Adult = mediaData["adult"];
     
      if(mediaData.hasOwnProperty("poster_path") && mediaData["poster_path"] != null) PosterImage = "https://image.tmdb.org/t/p/w342/"+mediaData["poster_path"];
      else PosterImage = "../cache/PosterNotFound.png"
      if(mediaData.hasOwnProperty("media_type") && mediaData["media_type"] != null) MediaType = mediaData["media_type"];

      
      let movieDomElement = document.createElement("div");
      let moviePosterElement = document.createElement("img");
      let removeFromLibraryButton = document.createElement("button"); 
      let movieNameElement = document.createElement("p");
      movieNameElement.innerText = Title;
      moviePosterElement.src = PosterImage;
      
      movieDomElement.classList.add("div-MovieElement");
      moviePosterElement.classList.add("img-MoviePoster");
      removeFromLibraryButton.classList.add("btn-remove-from-library");
      movieNameElement.classList.add("parag-MovieTitle");
      
      removeFromLibraryButton.innerHTML = `            
        <svg class="closeButtonIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" preserveAspectRatio="none">
          <path d="M183.1 137.4C170.6 124.9 150.3 124.9 137.8 137.4C125.3 149.9 125.3 170.2 137.8 182.7L275.2 320L137.9 457.4C125.4 469.9 125.4 490.2 137.9 502.7C150.4 515.2 170.7 515.2 183.2 502.7L320.5 365.3L457.9 502.6C470.4 515.1 490.7 515.1 503.2 502.6C515.7 490.1 515.7 469.8 503.2 457.3L365.8 320L503.1 182.6C515.6 170.1 515.6 149.8 503.1 137.3C490.6 124.8 470.3 124.8 457.8 137.3L320.5 274.7L183.1 137.4z"/>
        </svg>`
      movieDomElement.appendChild(moviePosterElement);
      movieDomElement.appendChild(removeFromLibraryButton);
      movieDomElement.appendChild(movieNameElement); 
      
      removeFromLibraryButton.addEventListener("click",()=>{removeMediaFromLibrary(Id,ThisMediaType,movieDomElement)});
      movieDomElement.addEventListener("click",()=>{openDetailPage(Id,ThisMediaType)});
      return movieDomElement;
}

async function loadData(){
  const apiKey = await window.electronAPI.getAPIKEY();
  const wholeLibraryInformation = await window.electronAPI.loadMediaLibraryInfo().catch(err=>console.error(err));
  RightmiddleDiv.style.opacity = 1;
  if(wholeLibraryInformation == undefined){
    let WarningElement = DisplayWarningOrErrorForUser("Your Library is Empty");
    RightmiddleDiv.appendChild(WarningElement);
    globalLoadingGif.remove();
    return;
  }
  fetchMediaData(apiKey,wholeLibraryInformation);

  SelectMediaType.addEventListener("change",()=>{
    MediaType = SelectMediaType.value;
    SavedMedia.innerHTML ="";
    fetchMediaData(apiKey,wholeLibraryInformation);
  });
}

function removeMediaFromLibrary(mediaId,mediaType,parentDiv){
  let MediaLibraryObject = {
    MediaId:mediaId,
    MediaType:mediaType
  }
  parentDiv.style.opacity = 0;
  setTimeout(()=>{
    let MediaElementsContainer = parentDiv.parentElement;
    parentDiv.remove();
    if(MediaElementsContainer.innerHTML.trim() == ""){
      let WarningElement = DisplayWarningOrErrorForUser("Your Library is Empty");
      WarningElement.style.marginBottom = "100px";
      RightmiddleDiv.appendChild(WarningElement);
    }
  },100);

  window.electronAPI.removeMediaFromLibrary(MediaLibraryObject);

  event.stopPropagation();
}


loadData();

setupKeyPressesForInputElement(searchInput);

setupKeyPressesHandler();

setLeftButtonStyle("btn-library");
