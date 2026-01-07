let submitButton = document.getElementById("login-btn");
let apiKeyInput = document.getElementById("api-key");
let toggleVisibilityButton = document.getElementById("toggle-visibility");
let errorDiv = document.getElementById("error-message");
let loadingDiv = document.getElementById("lds-dual-ring-container");
let loginText = document.getElementById("login-text");
let getApiKeyFromWebSite = document.getElementById("get-api-key-from-website");

const ExternelWebSiteUrl = "https://developer.themoviedb.org/docs/getting-started";

submitButton.addEventListener("click",()=>{
  let inputedApiKey = apiKeyInput.value;

  if(inputedApiKey.trim() !== ""){
    errorDiv.classList.remove("show");
    loginText.style.opacity = "0";
    loadingDiv.style.opacity = "1";
    window.electronAPI.validateApiKey(inputedApiKey)
      .then((res)=>{
        if(res.type === "verify-api-key"){
          if(res.responce === "api-key-not-valid"){
            errorDiv.innerText = "Api Key is not valid"
            errorDiv.classList.add("show");

          }else if(res.responce === "api-key-valid"){
            window.electronAPI.saveApiKey(inputedApiKey)
              .then(()=>{
                backToHome(true);
              });

          }else if(res.responce === "no-internet-connection"){
            errorDiv.innerText = "No internet connection"
            errorDiv.classList.add("show");
          }

        }

        loginText.style.opacity = "1";
        loadingDiv.style.opacity = "0";
      })
  }
});

toggleVisibilityButton.addEventListener("click",()=>{
  if(apiKeyInput.getAttribute("type") === "text"){
    apiKeyInput.setAttribute("type","password");
    toggleVisibilityButton.querySelector("img").src = "../assets/icons/openedEye.svg";
  } else {
    apiKeyInput.setAttribute("type","text");
    toggleVisibilityButton.querySelector("img").src = "../assets/icons/closedEye.svg";
  }
});

getApiKeyFromWebSite.addEventListener("click",()=>{
  window.electronAPI.openExternelLink(ExternelWebSiteUrl);
});


document.addEventListener("DOMContentLoaded", ()=>{
  handleFullScreenIcon();
});
