let data = new URLSearchParams(window.location.search);
let genreId = data.get("GenreId");
let MediaType = data.get("MediaType") == "All" ? "movie" : data.get("MediaType");

let RightmiddleDiv = document.getElementById("div-middle-right");
let globalLoadingGif = document.getElementById("div-globlaLoadingGif");
let searchInput = document.getElementById("input-searchForMovie");
let SelectMediaType = document.getElementById("select-type");
let SelectGenre = document.getElementById("select-Genres");
let MediaSuggestions = document.getElementById("div-MediaSuggestions");

let LibraryInformation = [];

function getDropdownValue(dropdown) {
  return dropdown.getAttribute('data-value') || dropdown.querySelector('.select-option').getAttribute('value');
}

function setDropdownValue(dropdown, value) {
  const option = dropdown.querySelector(`.select-option[value="${value}"]`);
  if (option) {
    const customSelect = dropdown.closest('.custom-select');
    const trigger = customSelect.querySelector('.select-trigger');
    trigger.textContent = option.textContent;
    dropdown.setAttribute('data-value', value);
    dropdown.querySelectorAll('.select-option').forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
  }
}

function syncDropdownWidths() {
  const customSelects = document.querySelectorAll('.custom-select');
  
  customSelects.forEach(select => {
    const trigger = select.querySelector('.select-trigger');
    const dropdown = select.querySelector('.select-dropdown');
    
    // Temporarily show dropdown to measure it
    dropdown.style.display = 'block';
    dropdown.style.opacity = '0';
    dropdown.style.pointerEvents = 'none';
    
    // Get the dropdown width
    const dropdownWidth = dropdown.offsetWidth;
    
    // Set trigger width to match
    trigger.style.width = dropdownWidth + 'px';
    
    // Hide dropdown again
    dropdown.style.display = '';
    dropdown.style.opacity = '';
    dropdown.style.pointerEvents = '';
  });
}

setDropdownValue(SelectMediaType, MediaType);

addSmoothTransition();
setTimeout(() => { try { globalLoadingGif.style.opacity = "1" } catch (err) { console.log(err) } }, 100);

async function fetchData(apiKey, genreId, ThisMediaType, page) {
  let url = "";
  ThisMediaType = getDropdownValue(SelectMediaType);

  if (genreId.toLowerCase() == "all") url = `https://api.themoviedb.org/3/${ThisMediaType}/popular?api_key=${apiKey}&page=${page}`;
  else url = `https://api.themoviedb.org/3/discover/${ThisMediaType}?api_key=${apiKey}&with_genres=${genreId}&page=${page}`;

  if (!LibraryInformation.length) LibraryInformation = await loadLibraryInfo();
  Promise.all([fetch(url).then(res => res.json())])
    .then(GenreData => {
      insertMediaElements(GenreData[0].results, MediaSuggestions, ThisMediaType, LibraryInformation);
      globalLoadingGif.remove();
    }
    );
}

function loadGenres(apiKey) {
  SelectGenre.innerHTML = "";
  MediaType = getDropdownValue(SelectMediaType);
  
  SelectGenre.innerHTML = '<div class="select-option" role="option" value="All">All</div>';
  
  let url = `https://api.themoviedb.org/3/genre/${MediaType}/list?api_key=${apiKey}`;
  if (MediaType == "All") url = `https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}`;
  
  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data.status_code == 7) throw new Error("We're having trouble loading data.</br>Please make sure your Authentication Key is valide!");
      let GenresData = data.genres;
      GenresData.forEach(GenreObj => {
        let optionElement = document.createElement("div");
        optionElement.className = "select-option";
        optionElement.setAttribute('role', 'option');
        optionElement.setAttribute('value', GenreObj.id);
        optionElement.textContent = GenreObj.name;
        SelectGenre.appendChild(optionElement);
      });
      
      manageDropDowns();
      setDropdownValue(SelectGenre, genreId);
      
      // Sync widths after options are loaded
      syncDropdownWidths();
      
      RightmiddleDiv.style.opacity = 1;
    })
    .catch(err => {
      setTimeout(() => {
        err.message = (err.message == "Failed to fetch") ? "We're having trouble loading data.</br>Please Check your connection and refresh!" : err.message;
        console.error(err);
        RightmiddleDiv.innerHTML = "";
        let WarningElement = DisplayWarningOrErrorForUser(err.message);
        RightmiddleDiv.appendChild(WarningElement);
        globalLoadingGif.remove();
        RightmiddleDiv.style.opacity = 1;
      }, 800);
    });
}

async function loadData() {
  MediaSuggestions.innerHTML = "";
  const apiKey = await window.electronAPI.getAPIKEY();
  
  manageDropDowns();
  
  loadGenres(apiKey);
  fetchData(apiKey, genreId, MediaType, 2);
  fetchData(apiKey, genreId, MediaType, 1);
  
  // Sync widths after initial load
  setTimeout(syncDropdownWidths, 100);

  SelectMediaType.addEventListener("dropdownChange", () => {
    MediaType = getDropdownValue(SelectMediaType);
    openDiscoveryPage(genreId, MediaType);
  });

  SelectGenre.addEventListener("dropdownChange", (event) => {
    let newGenreId = getDropdownValue(SelectGenre);
    MediaType = getDropdownValue(SelectMediaType);
    openDiscoveryPage(newGenreId, MediaType);
  });

  let pageLoaded = 2;
  RightmiddleDiv.addEventListener('scroll', function () {
    let middleRightDivHeight = window.innerHeight - RightmiddleDiv.getBoundingClientRect().top;
    if (RightmiddleDiv.scrollTop + middleRightDivHeight + 30 >= RightmiddleDiv.scrollHeight) {
      pageLoaded += 2;
      fetchData(apiKey, getDropdownValue(SelectGenre), MediaType, pageLoaded + 1);
      fetchData(apiKey, getDropdownValue(SelectGenre), MediaType, pageLoaded);
    }
  });
}

loadData();

setupKeyPressesForInputElement(searchInput);
setupKeyPressesHandler();
setLeftButtonStyle("btn-discover");
loadIconsDynamically();
handlingMiddleRightDivResizing();
