document.addEventListener("DOMContentLoaded", async function () {
  const hamburger = document.getElementById("hamburger");
  const navList = document.getElementById("nav-list");

  const copyBtn = document.querySelector(".copy-btn");
  const miniNavBtns = document.querySelectorAll(".mini-nav-btn");
  const sections = document.querySelectorAll(".section");
  const form = document.querySelector(".loopSessionCreateForm");
  // event listener to listen to load event:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  window.addEventListener("load", setDynamicHeight);
  // event listener to listen to resize event::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  window.addEventListener("resize", setDynamicHeight);
  // event listener for clicking on hamburger
  //setup the room first by fetching the section-2,3 data from the backend and then further execution
  await setUpDashbd();
  hamburger.addEventListener("click", () => {
    navList.classList.toggle("active");
  });
  //event listener for logout button
  document.querySelector(".logout-btn").addEventListener("click", async () => {
    //bring the popup
    popUpDisplay("Logging out...", "Please wait a few seconds!", "loader");
    popUpToggleUI();
    let errorBool = true; //to track if error occured or not
    try {
      //send logout request to the server
      const response = await fetch("/logout", {
        method: "GET",
        credentials: "same-origin", // To include cookies in the request
      });
      if (response.ok) {
        const newResponse = await response.json();
        console.log(newResponse);
        if (newResponse.status === "success") {
          errorBool = false;
          //successfully logged out
          popUpDisplay(
            "Logout Successful",
            "Redirecting to landing page...",
            "loader"
          );
          await delay(2000);
          popUpToggleUI();
          window.location.href = "/";
        }
      }
    } catch (error) {
      console.log(error);
    }
    if (errorBool) {
      popUpDisplay("Failed to logout.", "Pls try again later...", "loader");
      await delay(2000);
      popUpToggleUI();
    }
  });
  //event listener for copy button
  copyBtn.addEventListener("click", async () => {
    try {
      // Extract the loop ID using a regular expression
      const textContent = document.querySelector(
        ".copy-btn-container"
      ).textContent; // Get the text content of the container
      const loopIdMatch = textContent.match(/Your loop-id:\s*(\S+)/);
      const loopId = loopIdMatch[1]; // Extract the loop ID
      await navigator.clipboard.writeText(loopId);
      copyBtn.textContent = "✓ Copied!";
      setTimeout(() => {
        copyBtn.textContent = "📋 Copy";
      }, 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  });
  //event listener for mini-navbar button
  miniNavBtns.forEach((button) => {
    button.addEventListener("click", () => {
      // Remove 'active' class from all buttons
      miniNavBtns.forEach((btn) => btn.classList.remove("active"));

      // Add 'active' class to the clicked button
      button.classList.add("active");
      // Get the corresponding section ID from the data attribute
      const sectionId = button.getAttribute("data-section");

      // Hide all sections
      sections.forEach((section) => {
        section.classList.remove("active");
        section.style.display = "none";
      });

      // Show the corresponding section
      const activeSection = document.getElementById(sectionId);
      activeSection.classList.add("active");
      activeSection.style.display = "block";
    });
  });

  // Add a submit event listener to the form
  form.addEventListener("submit", async (event) => {
    const errMsgDiv = document.querySelector(".error-msg");
    errMsgDiv.textContent = "";
    errMsgDiv.classList.remove("show");
    event.preventDefault(); // Prevent actual form submission
    await toggleUIForCreateLoopSession();
    let errMsg = "";
    try {
      // Get the loop ID input value
      const receiverLID = form.elements["receiver-loop-id"].value;
      // Combine the data into an object
      const formData = {
        receiverLID,
      };
      const response = await fetch("/createLoopSession", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData), // Convert the data to JSON string
      });
      if (response.status === 200) {
        const newResponse = await response.json();
        console.log(newResponse);
        if (newResponse.status === "success") {
          //loop session created successfully
          postCreationToggleUI(newResponse.message);
        } else {
          errMsg = newResponse.message;
          //unsuccessfull creation ,,mention exact reason
        }
      } else {
        errMsg = "Failed to generate loop, pls try again later!!";
        console.log("server error ,,try again later!!!");
      }
    } catch {
      errMsg = "Failed to generate loop, pls try again later!!";
    }
    await toggleUIForCreateLoopSession();
    if (errMsg != "") {
      console.log(errMsg);
      errMsgDiv.classList.add("show");
      errMsgDiv.textContent = errMsg;
    }
  });
});
async function setUpDashbd() {
  //bring the popup
  popUpDisplay(
    "Setting up the dashboard!!",
    "Please wait a few seconds!",
    "loader"
  );
  popUpToggleUI();
  await updateSection2();
  await updateSection3();
  popUpToggleUI();
}
async function updateSection2() {
  //setup the loopsCreated section
  const section2 = document.getElementById("section-2");
  section2.innerHTML = `<div class="loop-page-heading"><h2>Your active loops</h2></div>`;
  const loadingText = document.createElement("h4");
  loadingText.textContent = "Loading...";
  loadingText.style.marginBottom = "3%";
  //creating a spinner element and appending it to the innerhtml of the section
  const spinner = document.createElement("div");
  spinner.classList.add("spinner");
  section2.appendChild(loadingText);
  section2.appendChild(spinner);
  //fetch createdLoops data from the backend and display it here dynamically
  let errMsg = "";
  try {
    const response = await fetch("/getCreatedLoopsData");
    if (response.ok) {
      const newResponse = await response.json();
      console.log(newResponse);
      if (newResponse.status === "success") {
        //successfully received data from the backend
        //first clear off the loading animation...
        section2.removeChild(loadingText);
        section2.removeChild(spinner);
        //now, we will create bars and append it to the section2 div
        const data = newResponse.message;
        if (data.length < 1) {
          errMsg =
            "No loops are created yet, pls goto the loop creation section and try to create your first loop";
        } else {
          //this is the real case.Now, we will create bars and append it to the section2 div....
          section2.innerHTML += `<button   class="section2retryBtn small-btn">Refresh</button>`;
          for (let i = 0; i < data.length; i++) {
            await popUpBar(section2, 2, data[i]);
          }
          return;
        }
      } else {
        //will get executed if response.status=false
        errMsg =
          "Failed to get details, server issue. <br>Pls try again later!!!";
      }
    } else {
      errMsg =
        "Failed to get details, server issue. <br>Pls try again later!!!";
    }
  } catch {
    errMsg = "Failed to get details. <br>Pls try again later!!!";
  }
  if (errMsg != "") {
    //it means an error has occured so ui changes accordingly
    const newHTML = `<div class="loop-page-heading"><h2>Your active loops</h2></div><h4>${errMsg}</h4><button class="section2retryBtn">Retry</button>`;
    section2.innerHTML = newHTML;
  }
}
//
async function updateSection3() {
  //setup the loopsCreated section
  const section3 = document.getElementById("section-3");
  section3.innerHTML = `<div class="loop-page-heading"><h2>Incoming loop requests</h2></div>`;
  const loadingText = document.createElement("h4");
  loadingText.textContent = "Loading...";
  loadingText.style.marginBottom = "3%";
  //creating a spinner element and appending it to the innerhtml of the section
  const spinner = document.createElement("div");
  spinner.classList.add("spinner");
  section3.appendChild(loadingText);
  section3.appendChild(spinner);
  //fetch createdLoops data from the backend and display it here dynamically
  let errMsg = "";
  try {
    const response = await fetch("/getIncomingLoopsData");
    if (response.ok) {
      const newResponse = await response.json();
      console.log(newResponse);
      if (newResponse.status === "success") {
        //successfully received data from the backend
        //first clear off the loading animation...
        section3.removeChild(loadingText);
        section3.removeChild(spinner);
        const data = newResponse.message;
        if (data.length < 1) {
          errMsg =
            "No loops are created yet, pls goto the loop creation section and try to create your first loop";
        } else {
          //this is the real case.Now, we will create bars and append it to the section2 div....
          section3.innerHTML += `<button  class="section3refreshBtn small-btn">Refresh</button>`;
          for (let i = 0; i < data.length; i++) {
            await popUpBar(section3, 3, data[i]);
          }
          return;
        }
      } else {
        //will get executed if response.status=false
        errMsg =
          "Failed to get details, server issue. <br>Pls try again later!!!";
      }
    } else {
      errMsg =
        "Failed to get details, server issue. <br>Pls try again later!!!";
    }
  } catch {
    errMsg = "Failed to get details. <br>Pls try again later!!!";
  }
  if (errMsg != "") {
    //it means an error has occured so ui changes accordingly
    const newHTML = `<div class="loop-page-heading"><h2>Your active loops</h2></div><h4>${errMsg}</h4><button class="section3refreshBtn">Refresh</button>`;
    section3.innerHTML = newHTML;
  }
}
async function toggleUIForCreateLoopSession() {
  const createBtn = document.querySelector(".create-button");
  if (createBtn.disabled) {
    //it means that the button is in active state so make it inactive
    createBtn.innerHTML = "Create loop-session";
    createBtn.disabled = false;
  } else {
    //it means the button is in inactive state so make it active
    createBtn.disabled = true;
    //creating a spinner element and appending it to the innerhtml of the button
    const spinner = document.createElement("div");
    spinner.classList.add("spinner");
    createBtn.innerHTML = "";
    createBtn.appendChild(spinner);
  }
}
async function popUpBar(targetDiv, sectionNo, data) {
  const loopRoomURL = `loop-connect.onrender.com/loopRooms?roomID=${data.loopRoomID}`;
  const time = await getReadableDate(data.roomCreationTime);
  let HTMLcontent;
  if (sectionNo === 2) {
    //this is for section-2
    HTMLcontent = ` <div class="bar">
     <div class="bar-id-display">Created for:<br> LID: ${data.receiverLID} </div>
      <div class="bar-id-display">Created on:<br> ${time}
  </div>
      <div class="bar-button-container">
        <button data-link="${loopRoomURL}" class="bar-button copy barCopyBtn">📋 Copy Link</button>
        <button onclick="window.location.href='${loopRoomURL}'" class="bar-button join">Join Now</button>
      </div>`;
  } else {
    //this is for section-3
    HTMLcontent = ` <div class="bar">
     <div class="bar-id-display">Created by:<br> LID: ${data.senderLID} </div>
      <div class="bar-id-display">Created on:<br> ${time}
  </div>
      <div class="bar-button-container">
        <button data-link="${loopRoomURL}" class="bar-button copy barCopyBtn">📋 Copy Link</button>
        <button onclick="window.location.href='${loopRoomURL}'" class="bar-button join">Join Now</button>
      </div>`;
  }
  targetDiv.innerHTML += HTMLcontent;
}
async function getReadableDate(data) {
  // Convert to milliseconds
  const milliseconds = data._seconds * 1000 + data._nanoseconds / 1_000_000;
  // Create a Date object
  const date = new Date(milliseconds);
  // Format the date and time using toLocaleString
  // Extract the components
  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const weekday = date.toLocaleString("en-US", { weekday: "long" });
  const month = date.toLocaleString("en-US", { month: "long" });
  const day = date.getDate();
  const year = date.getFullYear();

  // Format the output in desired order: time, day, year
  const formattedDate = `${time}, ${weekday} ${month} ${day}, ${year}`;

  return formattedDate;
}
function postCreationToggleUI(message) {
  const currcontainer = document.querySelector("#section-1");
  //change the innerHTML of the entire section
  const newHTML = ` <h2>Your loop room with the user of LID : ${message.receiverLID} has been successfully created.</h2> <div class="bar">
    <div class="bar-id-display">Loop-Room URL: <a href="${message.loopRoomURL}" >${message.loopRoomURL}</a>
</div>
    <div class="bar-button-container">
      <button data-link="${message.loopRoomURL}" class="bar-button copy barCopyBtn">📋 Copy Link</button>
      <button onclick="window.location.href='${message.loopRoomURL}'" class="bar-button join">Join Now</button>
    </div>
  </div> <button class="newLoopCreateBtn">Create new loop-session</button>`;
  currcontainer.innerHTML = newHTML;
}
// using event delegation approach to add event listener to the dynamically generated HTML content
document.body.addEventListener("click", async function (event) {
  //event listener for creating new loop from the post creation page
  if (event.target.classList.contains("newLoopCreateBtn")) {
    // replace the older html content as before
    const currcontainer = document.querySelector("#section-1");
    const olderHTML = `<div class="loop-page-heading"><h2>Create loop session</h2></div>
        <form class="loopSessionCreateForm">
          <h2>Enter loop-id of the user you wanna connect to:</h2>
          <div class="input-container">
            <input
              required
              type="string"
              placeholder="Enter Loop-id"
              name="receiver-loop-id"
              class="receiver-loop-id"
            />
          </div>
          <button class="create-button">Create loop-session</button>
          <p class="error-msg">
            Error: this the error mesasage <br />
            this is the next line of error
          </p>
        </form>`;
    currcontainer.innerHTML = olderHTML;
  }
  //event listener for copy button inside the bars
  if (event.target.classList.contains("barCopyBtn")) {
    try {
      const button = event.target;
      // Retrieve the custom data from the button
      const link = button.dataset.link;
      await navigator.clipboard.writeText(link);
      button.textContent = "✓ Copied!";
      setTimeout(() => {
        button.textContent = "📋 Copy Link";
      }, 2000);
    } catch {
      button.textContent = "📋 Copy Link";
    }
  }
  if (event.target.classList.contains("section2retryBtn")) {
    //event listener for retry button of section-2
    event.target.disabled = true;
    await updateSection2();
    event.target.disabled = false;
  }
  if (event.target.classList.contains("section3refreshBtn")) {
    //event listener for refresh button of section-3
    event.target.disabled = true;
    await updateSection3();
    event.target.disabled = false;
  }
});
function setDynamicHeight() {
  //all the below calculations are done in pixels...
  const scrollableDiv = document.querySelector(".scrollable-div");
  const topOffset = scrollableDiv.getBoundingClientRect().top; // Get the distance from the top of the viewport to the .response-container

  // Calculate the available height by subtracting the top offset from the viewport height
  const availableHeight = window.innerHeight - topOffset;
  // Set the height of .response-container
  scrollableDiv.style.height = `${availableHeight}px`;
}

// Helper function to simulate delay
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function popUpDisplay(title, content, element) {
  const popupTitle = document.getElementById("popup-title");
  const popupBody = document.getElementById("popup-body");
  popupTitle.innerHTML = title;
  popupBody.innerHTML = content;
  if (element === "loader") {
    //show the loader animation and hide the refresh button
    document.querySelector(".loader").classList.remove("hidden");
    document.getElementById("popUp-refresh-btn").classList.add("hidden");
  } else if (element === "refreshbtn") {
    //show the refresh button and hide the loader animation
    document.querySelector(".loader").classList.add("hidden");
    document.getElementById("popUp-refresh-btn").classList.remove("hidden");
  } else {
    //show both the refresh button and the loader animation
    document.querySelector(".loader").classList.remove("hidden");
    document.getElementById("popUp-refresh-btn").classList.remove("hidden");
  }
}
function popUpToggleUI() {
  // Select all elements inside the body except the div with ID 'exclude-div'
  const elements = document.querySelectorAll("body > *:not(.popupOverlay)");
  // toggle each of the selected elements
  elements.forEach((element) => {
    element.classList.toggle("hidden");
  });
  // toggle the popUpDisplay
  const popupOverlay = document.querySelector("#popupOverlay");
  popupOverlay.classList.toggle("show");
}
