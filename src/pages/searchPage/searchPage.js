let RightmiddleDiv = document.getElementById("div-middle-right");
let MoviesRecommandationDiv = document.getElementById("div-middle-right-MoviesRecommandations");
let SeriesRecommandationDiv = document.getElementById("div-middle-right-SeriesRecommandations");
let FiguresRecommandationDiv = document.getElementById("div-middle-right-FiguresRecommandations");
let OtherRecommandationDiv = document.getElementById("div-middle-right-OtherRecommandations");
let globalLoadingGif = document.getElementById("div-globlaLoadingGif");
let searchInput = document.getElementById("input-searchForMovie");

const params = new URLSearchParams(window.location.search);
let searchKeyword = params.get("search");

document.title = searchKeyword +" - Nomixo";
searchInput.value = searchKeyword;
let searchQuery = searchKeyword.replaceAll(" ","%20");
let LibraryInformation;

async function loadData(){
  const apiKey = await window.electronAPI.getTMDBAPIKEY();
  LibraryInformation = await loadLibraryInfo();
  loadSearchInformation(apiKey);
}

function loadSearchInformation(apiKey) {
  const searchByImdbIdQuery = `https://api.themoviedb.org/3/find/${searchKeyword}?api_key=${apiKey}&external_source=imdb_id`;
  const searchByQuery = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${searchQuery}`;

  Promise.allSettled([
    fetch(searchByImdbIdQuery),
    fetch(searchByQuery)
  ])
    .then(async ([imdbRes, queryRes]) => {
      if (imdbRes.status === "rejected" || queryRes.status === "rejected")
        throw new Error("We’re having trouble loading data.</br>Please Check your connection and refresh!");

      if (imdbRes.value.status === 401 || queryRes.value.status === 401)
        throw new Error("We’re having trouble loading data.</br>Please make sure your Authentication Key is valide!");

      const imdbData = await imdbRes.value.json();
      const queryData = await queryRes.value.json();

      const mergedArray = [
        ...(imdbData.movie_results || []),
        ...(imdbData.tv_results || []),
        ...(imdbData.person_results || []),
        ...(imdbData.tv_episode_results || []),
        ...(imdbData.tv_season_results || []),
        ...(queryData.results || [])
      ];

      MoviesRecommandationDiv.innerHTML = "";
      SeriesRecommandationDiv.innerHTML = "";
      FiguresRecommandationDiv.innerHTML = "";
      OtherRecommandationDiv.innerHTML = "";

      if (mergedArray.length === 0) throw new Error(`Cannot Found Any Media Named: ${searchKeyword}`);

      RightmiddleDiv.classList.add("activate");
      insertResultsElement(mergedArray);
      if (MoviesRecommandationDiv.innerHTML.trim() === "") document.getElementById("MoviesRecommandationsContainer").remove();
      if (SeriesRecommandationDiv.innerHTML.trim() === "") document.getElementById("SeriesRecommandationsContainer").remove();
      if (FiguresRecommandationDiv.innerHTML.trim() === "") document.getElementById("FiguresRecommandationsContainer").remove();
      if (OtherRecommandationDiv.innerHTML.trim() === "") document.getElementById("OtherRecommandationsContainer").remove();
      globalLoadingGif.remove();
      checkIfDivShouldHaveMoveToRightOrLeftButton([MoviesRecommandationDiv, SeriesRecommandationDiv, FiguresRecommandationDiv, OtherRecommandationDiv]);
    })
    .catch(err => {
      let RightmiddleDiv = document.getElementById("div-middle-right");
      RightmiddleDiv.innerHTML = "";
      let displayRefreshButton = err.message.includes("Check your connection");

      let WarningElement = DisplayWarningOrErrorForUser(err.message, displayRefreshButton);
      RightmiddleDiv.appendChild(WarningElement);
      globalLoadingGif.remove();
      RightmiddleDiv.classList.add("activate");

      console.error(err);
    });
}

function insertResultsElement(data) {
  const ContainerDivs = [MoviesRecommandationDiv,SeriesRecommandationDiv,FiguresRecommandationDiv,OtherRecommandationDiv];
  insertMediaElements(data, ContainerDivs, null, LibraryInformation)
}

triggerLoadingGif();
loadData();
resizeMoviesPostersContainers([MoviesRecommandationDiv,SeriesRecommandationDiv,FiguresRecommandationDiv,OtherRecommandationDiv]);
setupKeyPressesHandler();
setupNavigationBtnHandler();
setupKeyPressesForInputElement(searchInput);
loadIconsDynamically();
handlingMiddleRightDivResizing();
createSearchHistoryDropDown();
