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
      if(Number(data.status_code) === 7) throw new Error("We’re having trouble loading data.</br>Please make sure your Authentication Key is valide!");
      if(Number(data.total_results) === 0) throw new Error(`Cannot Found Any Media Named: ${searchKeyword}`)

      RightmiddleDiv.style.opacity = 1;
      insertResultsElement(data);
      if(MoviesRecommandationDiv.innerHTML.trim() === "") document.getElementById("MoviesRecommandationsContainer").remove();
      if(SeriesRecommandationDiv.innerHTML.trim() === "") document.getElementById("SeriesRecommandationsContainer").remove();
      if(FiguresRecommandationDiv.innerHTML.trim() === "") document.getElementById("FiguresRecommandationsContainer").remove();
      if(OtherRecommandationDiv.innerHTML.trim() === "") document.getElementById("OtherRecommandationsContainer").remove();
      globalLoadingGif.remove();
      checkIfDivShouldHaveMoveToRightOrLeftButton([MoviesRecommandationDiv,SeriesRecommandationDiv,FiguresRecommandationDiv,OtherRecommandationDiv]);

  }).catch(err=>{ 
    let RightmiddleDiv = document.getElementById("div-middle-right");
    RightmiddleDiv.innerHTML ="";
    let displayRefreshButton = err.message === "Failed to fetch";

    if(err.message === "Failed to fetch"){
      err.message = "We’re having trouble loading data.</br>Please Check your connection and refresh!";
    }

    let WarningElement = DisplayWarningOrErrorForUser(err.message,displayRefreshButton);
    RightmiddleDiv.appendChild(WarningElement);
    globalLoadingGif.remove();
    RightmiddleDiv.style.opacity = 1;

    console.error(err)
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
