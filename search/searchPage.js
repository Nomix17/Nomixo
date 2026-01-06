let RightmiddleDiv = document.getElementById("div-middle-right");
let MoviesRecommandationDiv = document.getElementById("div-middle-right-MoviesRecommandations");
let SeriesRecommandationDiv = document.getElementById("div-middle-right-SeriesRecommandations");
let FiguresRecommandationDiv = document.getElementById("div-middle-right-FiguresRecommandations");
let OtherRecommandationDiv = document.getElementById("div-middle-right-OtherRecommandations");
let globalLoadingGif = document.getElementById("div-globlaLoadingGif");
let searchInput = document.getElementById("input-searchForMovie");

addSmoothTransition();
setTimeout(()=>{try{globalLoadingGif.style.opacity = "1"}catch(err){console.log(err)}},100);

const params = new URLSearchParams(window.location.search);
let searchKeyword = params.get("search");
const apiKey = window.electronAPI.getAPIKEY();

document.title = searchKeyword +" - Nomixo";
searchInput.value = searchKeyword;
let searchQuery = searchKeyword.replaceAll(" ","%20");
let LibraryInformation;

async function loadData(){
  const apiKey = await window.electronAPI.getAPIKEY();
  LibraryInformation = await loadLibraryInfo();
  loadSearchInformation(apiKey);
}

function loadSearchInformation(apiKey){
  fetch(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${searchQuery}`)
    .then(res => res.json())
    .then(data => {

      MoviesRecommandationDiv.innerHTML = "";
      SeriesRecommandationDiv.innerHTML = "";
      FiguresRecommandationDiv.innerHTML = "";
      OtherRecommandationDiv.innerHTML = "";
      if(data.status_code == 7) throw new Error("We’re having trouble loading data.</br>Please make sure your Authentication Key is valide!");
      if(data.total_results == 0) throw new Error(`Cannot Found Any Media Named: ${searchKeyword}`)

      RightmiddleDiv.style.opacity = 1;
      insertResultsElement(data);
      if(MoviesRecommandationDiv.innerHTML == "") document.getElementById("MoviesRecommandationsContainer").remove();
      if(SeriesRecommandationDiv.innerHTML == "") document.getElementById("SeriesRecommandationsContainer").remove();
      if(FiguresRecommandationDiv.innerHTML == "") document.getElementById("FiguresRecommandationsContainer").remove();
      if(OtherRecommandationDiv.innerHTML == "") document.getElementById("OtherRecommandationsContainer").remove();
      globalLoadingGif.remove();
      checkIfDivShouldHaveMoveToRightOrLeftButton([MoviesRecommandationDiv,SeriesRecommandationDiv,FiguresRecommandationDiv,OtherRecommandationDiv]);
  }).catch(err=>{
    err.message = (err.message === "Failed to fetch") ? "We’re having trouble loading data.</br>Please Check your connection and refresh!":err.message;
    console.error(err)
    let RightmiddleDiv = document.getElementById("div-middle-right");
    RightmiddleDiv.innerHTML ="";
    let WarningElement = DisplayWarningOrErrorForUser(err.message,false);
    RightmiddleDiv.appendChild(WarningElement);
    globalLoadingGif.remove();
    RightmiddleDiv.style.opacity = 1;
  });
}


function insertResultsElement(data){
  let searchResults = data.results;
  let ContainerDivs = [MoviesRecommandationDiv,SeriesRecommandationDiv,FiguresRecommandationDiv,OtherRecommandationDiv];
  insertMediaElements(searchResults,ContainerDivs,null,LibraryInformation)
}

loadData();

resizeMoviesPostersContainers([MoviesRecommandationDiv,SeriesRecommandationDiv,FiguresRecommandationDiv,OtherRecommandationDiv]);

setupKeyPressesHandler();

setupNavigationBtnHandler();

setupKeyPressesForInputElement(searchInput);

loadIconsDynamically();

handlingMiddleRightDivResizing();
