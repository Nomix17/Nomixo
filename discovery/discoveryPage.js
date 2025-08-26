let data = new URLSearchParams(window.location.search);
let genreId = data.get("GenreId");
let MediaType = data.get("MediaType") == "All"? "movie": data.get("MediaType") ;

let searchInput = document.getElementById("input-searchForMovie");
let SelectMediaType = document.getElementById("select-type");
let SelectGenre = document.getElementById("select-Genres");
let MediaSuggestions = document.getElementById("div-MediaSuggestions")

SelectMediaType.value = MediaType;

let LibraryInformation = [];
addSmoothTransition();

async function fetchData(apiKey,genreId, ThisMediaType,page){
  let url ="";
  ThisMediaType = SelectMediaType.value;
  SelectMediaType.value = ThisMediaType;

  if(genreId.toLowerCase() == "all") url = `https://api.themoviedb.org/3/${ThisMediaType}/popular?api_key=${apiKey}&page=${page}`;
  else url = `https://api.themoviedb.org/3/discover/${ThisMediaType}?api_key=${apiKey}&with_genres=${genreId}&page=${page}`;

  if(!LibraryInformation.length) LibraryInformation = await loadLibraryInfo();
  Promise.all([fetch(url).then(res=>res.json())])
    .then(GenreData => insertMediaElements(GenreData[0].results,MediaSuggestions,ThisMediaType,LibraryInformation));

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
    let GenresData = data.genres; 
    GenresData.forEach(GenreObj => {
      let OptionElement = document.createElement("option");
      OptionElement.value = GenreObj.id;
      OptionElement.innerText = GenreObj.name;
      SelectGenre.append(OptionElement);
    });
      SelectGenre.value = genreId;
      document.querySelector("h1").innerHTML = SelectGenre.selectedOptions[0].text;

  });
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
  window.addEventListener('scroll', function() {
    if(window.innerHeight + window.scrollY + 30 >= document.body.scrollHeight){
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

