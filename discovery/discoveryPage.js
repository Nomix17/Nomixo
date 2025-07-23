let data = new URLSearchParams(window.location.search);
let genreId = data.get("GenreId");
let MediaType = data.get("MediaType") == "All"? "movie": data.get("MediaType") ;


let SelectMediaType = document.getElementById("select-type");
let SelectGenre = document.getElementById("select-Genres");
let MediaSuggestions = document.getElementById("div-MediaSuggestions")
SelectMediaType.value = MediaType;


function fetchData(apiKey,genreId, ThisMediaType,page){
  let url ="";
  ThisMediaType = SelectMediaType.value;
  SelectMediaType.value = ThisMediaType;
  if(genreId.toLowerCase() == "all") url = `https://api.themoviedb.org/3/${ThisMediaType}/popular?api_key=${apiKey}&page=${page}`;
  else url = `https://api.themoviedb.org/3/discover/${ThisMediaType}?api_key=${apiKey}&with_genres=${genreId}&page=${page}`;
  Promise.all([fetch(url).then(res=>res.json())])
    .then(GenreData => insertDataIntoDiv(GenreData,ThisMediaType));
}

function insertDataIntoDiv(GenreData,ThisMediaType){
    let GenreResults = GenreData[0].results;
    GenreResults.forEach(obj => {
      let Id = "Unknown";
      let Title = "Unknown";
      let Adult = "Unknown";
      let PosterImage = "Unknown";
      let MediaType = "Unknown";

      if(obj.hasOwnProperty("id")) Id = obj["id"];
      
      if(obj.hasOwnProperty("title")) Title = obj["title"];
      else Title = obj["name"];

      if(obj.hasOwnProperty("adult")) Adult = obj["adult"];
     
      if(obj.hasOwnProperty("poster_path") && obj["poster_path"] != null) PosterImage = "https://image.tmdb.org/t/p/w342/"+obj["poster_path"];
      else PosterImage = "../cache/PosterNotFound.png"
      if(obj.hasOwnProperty("media_type") && obj["media_type"] != null) MediaType = obj["media_type"];

      
      let movieDomElement = document.createElement("div");
      let moviePosterElement = document.createElement("img");
      let movieNameElement = document.createElement("p");

      movieNameElement.innerText = Title;
      moviePosterElement.src = PosterImage;
      
      movieDomElement.classList.add("div-MovieElement");
      moviePosterElement.classList.add("img-MoviePoster");
      movieNameElement.classList.add("parag-MovieTitle");

      movieDomElement.appendChild(moviePosterElement);
      movieDomElement.appendChild(movieNameElement); 

      movieDomElement.addEventListener("click",function() {openDetailPage(Id,ThisMediaType)});
      MediaSuggestions.append(movieDomElement);

    });
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

    MediaSuggestions.innerHTML ="";
    fetchData(apiKey,"all", MediaType,2);
    fetchData(apiKey,"all", MediaType,1);
    loadGenres(apiKey);
  });


  SelectGenre.addEventListener("change",(event)=>{
    let newGenreId = SelectGenre.value;
    let name = event.target.selectedOptions[0].text;
    MediaType = SelectMediaType.value;
    
    MediaSuggestions.innerHTML ="";
    fetchData(apikey,newGenreId, MediaType,2);
    fetchData(apiKey,newGenreId, MediaType,1);

    document.querySelector("h1").innerText = name;
    SelectGenre.target.selectedOptions[0].text = name;
  });

  let pageLoaded = 2;
  window.addEventListener('scroll', function() {
    if(window.innerHeight + window.scrollY >= document.body.scrollHeight){
      pageLoaded += 2; 
      fetchData(apiKey,SelectGenre.value, MediaType,pageLoaded+1);
      fetchData(apiKey,SelectGenre.value, MediaType,pageLoaded);
    }
  });
}

loadData();

let searchInput = document.getElementById("input-searchForMovie");
searchInput.addEventListener("keypress",(event)=>{
  if(event.key == "Enter") openSearchPage();
});

window.addEventListener("keydown",(event)=>{
  if(event.key == "Escape") window.electronAPI.goBack();
  if (event.key == "Tab" ||
      event.key == "Super" ||
      event.key == "Alt" ) event.preventDefault();
});


// on click functions
function openSearchPage(){
  let searchKeyword = document.getElementById("input-searchForMovie").value;
  if(searchKeyword !="") location.href="../search/searchPage.html?search="+searchKeyword;

}
function openDetailPage(movieId,mediaType){
  location.href = "../movieDetail/movieDetail.html?MovieId="+movieId+"&MediaType="+mediaType;
}
function backToHome(){
  location.href = "../home/mainPage.html"
}
function fullscreenClicked(){
  window.electronAPI.toggleFullscreen();
}


