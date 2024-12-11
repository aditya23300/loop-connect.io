import { provider, auth, signInWithPopup } from "../../firebase-config.js";
document.addEventListener("DOMContentLoaded", function () {
  const contentDiv = document.querySelector(".content");
  // Get the hamburger menu and nav list elements
  const hamburger = document.getElementById("hamburger");
  const navList = document.getElementById("nav-list");

  // Toggle the active class on the nav list when the hamburger is clicked
  hamburger.addEventListener("click", () => {
    navList.classList.toggle("active");
  });

  document.getElementById("home").addEventListener("click", () => {
    contentDiv.style.paddingTop = "10%";
    contentDiv.innerHTML = homeHTML;
  });
  document.getElementById("about").addEventListener("click", () => {
    contentDiv.style.paddingTop = "5%";
    contentDiv.innerHTML = aboutHTML;
  });
  document.getElementById("services").addEventListener("click", () => {
    contentDiv.style.paddingTop = "5%";
    contentDiv.innerHTML = servicesHTML;
  });
  document.getElementById("contact-us").addEventListener("click", () => {
    contentDiv.style.paddingTop = "5%";
    contentDiv.innerHTML = contactUsHTML;
  });
  // Add event listener to the parent container ie content div
  contentDiv.addEventListener("click", async function (event) {
    if (event.target.id === "getStartedBtn") {
      //event listerner for get started button
      await googleAuthRequestHandler();
    }
    if (event.target.id === "mailUsBtn") {
      //event listerner for mail-us button
      window.location.href =
        "mailto:adityaraj23300@gmail.com?subject=Query Regarding LoopConnect.io&body=Please guide me on how to use this webapp";
    }
  });
});
//functions/variables def below

async function googleAuthRequestHandler() {
  const popupOverlay = document.getElementById("popupOverlay");
  const popupTitle = document.getElementById("popup-title");
  const popupBody = document.getElementById("popup-body");
  try {
    const result = await signInWithPopup(auth, provider);
    popupOverlay.classList.add("show");
    popupTitle.innerHTML = "Sign-in successful!!!";
    popupBody.innerHTML = "Pls wait a few seconds...";
    // The signed-in user info.
    const userInfo = result.user;
    const response = await fetch("/postGoogleSignInRoute", {
      method: "POST", // Specify the request method
      headers: {
        "Content-Type": "application/json", // Set the content type to JSON
      },
      body: JSON.stringify(userInfo), // Convert the data object to a JSON string
    });
    const newResponse = await response.json();
    if (response.ok && newResponse.success === true) {
      popupOverlay.classList.remove("show");
      window.location.href = "/dashbd/home";
    } else {
      popupTitle.innerHTML = "Oops!!! Server error occured.Pls try again later";
      popupBody.innerHTML = "Redirecting back to homepage...";
      setTimeout(() => {
        popupOverlay.classList.remove("show");
        window.location.href = "/";
      }, 2000);
    }
  } catch (error) {
    popupOverlay.classList.add("show");
    popupTitle.innerHTML = "Sign-in failed!!!";
    popupBody.innerHTML = "Redirecting back to homepage...";
    setTimeout(() => {
      window.location.href = "/";
    }, 2000);
  }
}
const homeHTML = ` <h1>
Interact/Share/Chat with anyone, securely,one loop at a time!
<br /><br />Try loopconnect now!!!
</h1>
<div class="button-container">
<button id="getStartedBtn" class="animated-button">Get started</button>
</div>`;
const aboutHTML = ` <h1>
About-Us:
</h1>
<p>
LoopConnect.io is your trusted platform for secure communication. Designed to prioritize privacy, our platform enables one-to-one video calls, file sharing, and text chatting—all fortified with cutting-edge encryption to ensure no unauthorized access. Whether you’re collaborating professionally or connecting personally, LoopConnect.io guarantees unparalleled security and peace of mind.</p>
<div class="button-container">
<button id="getStartedBtn" class="animated-button">Get started</button>
</div>`;
const servicesHTML = ` <h1>
Our offerings:
</h1>
 <ul>
    <li><h4>Secure Video Calls:</h4> Crystal-clear, private one-on-one video communication.</li>
    <li><h4>Encrypted File Sharing:</h4> Seamlessly exchange files with robust protection.</li>
    <li><h4>Instant Text Chat:</h4> Engage in real-time conversations with uncompromising security.</li>
    <li><h4>Confidentiality Redefined:</h4>Our platform ensures your data remains safe, empowering you to communicate with confidence.</li>
  </ul>
<div class="button-container">
<button id="getStartedBtn" class="animated-button">Get started</button>
</div>`;
const contactUsHTML = ` <h1>
Contact Us:
</h1>
<p>
Have questions or need support? We’re here to help with all your communication needs.<br />Email us at adityaraj23300@gmail.com. <br />Your privacy and satisfaction are our top priorities.</p><div class="button-container">
<button id="mailUsBtn" class="animated-button">Mail-Us</button>
</div>`;
