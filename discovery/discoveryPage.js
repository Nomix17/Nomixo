let data = new URLSearchParams(window.location.search);
let genreId = data.get("GenreId");
let MediaType = data.get("MediaType") == "All"? "movie": data.get("MediaType") ;

let RightmiddleDiv = document.getElementById("div-middle-right");
let globalLoadingGif = document.getElementById("div-globlaLoadingGif");
let searchInput = document.getElementById("input-searchForMovie");
let SelectMediaType = document.getElementById("select-type");
let SelectGenre = document.getElementById("select-Genres");
let MediaSuggestions = document.getElementById("div-MediaSuggestions")

SelectMediaType.value = MediaType;

let LibraryInformation = [];

addSmoothTransition();
setTimeout(()=>{try{globalLoadingGif.style.opacity = "1"}catch(err){console.log(err)}},100);

async function fetchData(apiKey,genreId, ThisMediaType,page){
  let url ="";
  ThisMediaType = SelectMediaType.value;
  SelectMediaType.value = ThisMediaType;

  if(genreId.toLowerCase() == "all") url = `https://api.themoviedb.org/3/${ThisMediaType}/popular?api_key=${apiKey}&page=${page}`;
  else url = `https://api.themoviedb.org/3/discover/${ThisMediaType}?api_key=${apiKey}&with_genres=${genreId}&page=${page}`;

  if(!LibraryInformation.length) LibraryInformation = await loadLibraryInfo();
  Promise.all([fetch(url).then(res=>res.json())])
    .then(GenreData => {
      insertMediaElements(GenreData[0].results,MediaSuggestions,ThisMediaType,LibraryInformation);
      globalLoadingGif.remove();
    }
  );

}

function loadGenres(apiKey){
  SelectGenre.innerHTML = "";
  MediaType = SelectMediaType.value;
  SelectGenre.innerHTML ="<option value='All'>All</option>";
  let url = `https://api.themoviedb.org/3/genre/${MediaType}/list?api_key=${apiKey}`;
  if(MediaType == "All") url = `https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}`
  fetch(url)
  .then(res => res.json())
  .then(data => {
    if(data.status_code == 7 ) throw new Error("We’re having trouble loading data.</br>Please make sure your Authentication Key is valide!");
    let GenresData = data.genres; 
    GenresData.forEach(GenreObj => {
      let OptionElement = document.createElement("option");
      OptionElement.value = GenreObj.id;
      OptionElement.innerText = GenreObj.name;
      SelectGenre.append(OptionElement);
    });
    SelectGenre.value = genreId;
    document.querySelector("h1").innerHTML = SelectGenre.selectedOptions[0].text;
    RightmiddleDiv.style.opacity = 1;

  }).catch(err => {
    setTimeout(()=>{
      err.message = (err.message == "Failed to fetch") ? "We’re having trouble loading data.</br>Please Check your connection and refresh!":err.message;
      console.error(err);
      RightmiddleDiv.innerHTML ="";
      let WarningElement = DisplayWarningOrErrorForUser(err.message);
      RightmiddleDiv.appendChild(WarningElement);
      globalLoadingGif.remove();
      RightmiddleDiv.style.opacity = 1;
    },800);
  })
}

async function loadData(){
  MediaSuggestions.innerHTML ="";
  const apiKey = await window.electronAPI.getAPIKEY();
  loadGenres(apiKey);
  fetchData(apiKey,genreId,MediaType,2);
  fetchData(apiKey,genreId,MediaType,1);

  SelectMediaType.addEventListener("change",()=>{
    MediaType = SelectMediaType.value;
    openDiscoveryPage(genreId, MediaType);
  });


  SelectGenre.addEventListener("change",(event)=>{
    let newGenreId = SelectGenre.value;
    let name = event.target.selectedOptions[0].text;
    MediaType = SelectMediaType.value;
    openDiscoveryPage(newGenreId, MediaType);
  });

  let pageLoaded = 2;
  RightmiddleDiv.addEventListener('scroll', function() {
    let middleRightDivHeight = window.innerHeight - RightmiddleDiv.getBoundingClientRect().top;
    console.log();
    console.log();
    if(RightmiddleDiv.scrollTop + middleRightDivHeight + 30 >= RightmiddleDiv.scrollHeight){
      pageLoaded += 2;
      fetchData(apiKey,SelectGenre.value, MediaType,pageLoaded+1);
      fetchData(apiKey,SelectGenre.value, MediaType,pageLoaded);
    }
  });
}


loadData();

setupKeyPressesForInputElement(searchInput);

setupKeyPressesHandler();

setLeftButtonStyle("btn-discover");

loadIconsDynamically();

handlingMiddleRightDivResizing();
