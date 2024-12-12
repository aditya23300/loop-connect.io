let peer,
  conn,
  senderPeerID,
  receiverPeerID,
  connectionStatus = { status: false, message: "" },
  monitoredConnection,
  refreshCount = 0,
  role,
  localStream,
  remoteStream;
const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
document.addEventListener("DOMContentLoaded", async () => {
  // Add event listeners for dynamic height adjustment
  window.addEventListener("load", async () => {
    while (!connectionStatus.status) {
      await delay(10);
    }
    setDynamicHeightResize();
  });
  window.addEventListener("resize", setDynamicHeightResize);
  // Get UI elements
  const sendBtn = document.getElementById("sendMessage");
  const msgInput = document.getElementById("messageInput");
  const fileInput = document.getElementById("fileInput");
  //call stream buttons
  // Add event listeners for video controls
  /* document
    .getElementById("toggle-video")
    .addEventListener("click", toggleVideoStream);
  document
    .getElementById("toggle-audio")
    .addEventListener("click", toggleAudioStream); */
  // Proxy setup for connection monitoring
  const handler = {
    set(target, key, value) {
      if (key === "status" && target[key] !== value) {
        console.log(`Status changed to: ${value}`);
        if (value) {
          console.log("Connection established");
        } else {
          console.log("Connection lost");
        }
        toggleUI();
      }
      target[key] = value;
      return true;
    },
  };
  monitoredConnection = new Proxy(connectionStatus, handler);
  // Text chat functionality
  sendBtn.addEventListener("click", () => {
    sendMessage();
  });
  msgInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });
  const sendFileBtn = document.getElementById("sendFile");
  // Trigger the file input popup when the button is clicked
  sendFileBtn.addEventListener("click", () => {
    fileInput.click(); // Programmatically opens the file input dialog
  });
  // File sharing functionality
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file && conn && conn.open) {
      const reader = new FileReader();
      reader.onload = () => {
        conn.send({
          type: "file",
          filename: file.name,
          data: reader.result,
        });
        appendMessage("You", `Sent a file: ${file.name}`);
      };
      reader.readAsArrayBuffer(file);
    }
  });
  //event delegation approach used here to create this event listener for dynamic elements: read about it and make notes
  document.addEventListener("click", (e) => {
    // Check if the clicked element has the "view-file-btn" class
    if (e.target.classList.contains("view-file-btn")) {
      const fileUrl = e.target.getAttribute("data-url"); // Get the file URL
      if (fileUrl) window.open(fileUrl, "_blank"); // Open the file in a new tab
    }
  });
  //event listener for chat-box view button
  const chatBoxView = document.querySelector(".view-chat-box");
  chatBoxView.addEventListener("click", () => {
    //1st step: change button content
    chatBoxView.textContent =
      chatBoxView.textContent === "Hide Chat-Box"
        ? "Show Chat-Box"
        : "Hide Chat-Box";
    //1st step: hide/show the chat-box
    const chatBox = document.querySelector(".chat-box");
    chatBox.classList.toggle("hidden");
    //2nd step: resize the local video stream element
    const localVidElement = document.querySelector(".local-video-div");
    localVidElement.classList.toggle("toggle-local-vid");
  });
  //room execution starts from here:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  popUpDisplay(
    "Setting up loop-room!!",
    "Please wait a few seconds!",
    "loader"
  );
  toggleUI();
  await roomInitialiser();

  function sendMessage() {
    if (msgInput.value.trim() !== "" && conn && conn.open) {
      conn.send({
        type: "message",
        content: msgInput.value,
      });
      appendMessage("You", msgInput.value);
      msgInput.value = "";
    }
  }
});

async function roomInitialiser() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roomID = urlParams.get("roomID");

    const response = await fetch(`/setupRoom?roomID=${roomID}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const newResponse = await response.json();

    if (response.ok && newResponse.status === "success") {
      console.log("Room setup response:", newResponse);

      senderPeerID = newResponse.roomInfo.senderLID;
      receiverPeerID = newResponse.roomInfo.receiverLID;
      role = newResponse.role;
      // Initialize PeerJS connection
      peer = new Peer(newResponse.userInfo.loopID, {
        host: "peerserver-1.onrender.com",
        port: 443, // Use 443 for HTTPS, or 80 for HTTPS
        path: "/peerjs",
        secure: true, // Set to true for HTTPS
        debug: 3,
      });
      const myBuddyID =
        newResponse.userInfo.loopID === receiverPeerID
          ? senderPeerID
          : receiverPeerID;
      // Set up peer event handlers
      peer.on("open", async () => {
        console.log("Connected to PeerJS server");
        popUpDisplay(
          "Room setup successfully!!!",
          `Waiting for the user with loopId "${myBuddyID}" to join... `,
          "loader"
        );
        const vidStream = await initialiseLocalStream();
        if (vidStream) {
          await createConnection(newResponse);
        }
      });

      peer.on("error", async (error) => {
        console.error("Peer connection error:", error);
        const k = 1; //no of refreshes to be done after one click of the refresh button
        if (refreshCount < k) {
          peer.disconnect();
          peer.reconnect();
          refreshCount++;
          console.log("no of refreshes left: ", k - refreshCount);
        } else {
          await reconnectHandler();
        }
      });
    } else {
      console.error("Failed to initialize room setup");
      popUpDisplay(
        "Failed to setup the loop-room",
        "Please click the refresh button or reload the page",
        "refreshbtn"
      );
    }
  } catch (error) {
    console.error("Room initialization error:", error);
    popUpDisplay(
      "Error encountered! Failed to setup the loop-room",
      "Please click the refresh button or reload the page",
      "refreshbtn"
    );
  }
}

async function createConnection(newResponse) {
  if (newResponse.role === "sender") {
    console.log("Initializing as sender");
    conn = peer.connect(receiverPeerID);

    conn.on("open", async () => {
      try {
        console.log("Sender connection established");
        await setupVideoCall();
        conn.off("data"); // Remove existing listeners to prevent duplication
        conn.on("data", (data) => {
          console.log("Received data:", data);
          if (data.type === "file") {
            handleFileReceived(data);
          } else if (data.type === "message") {
            appendMessage("Peer", data.content);
          }
        });

        conn.on("error", async (err) => {
          console.error("Connection error:", err);
          await reconnectHandler();
        });

        conn.on("close", async () => {
          console.log("Connection closed");
          await reconnectHandler();
        });
      } catch (error) {
        console.error(error);
      }
    });
  } else {
    console.log("Initialized as receiver");
    popUpDisplay(
      "Waiting for the user to join the room!!!",
      `Note: You can click on the refresh button to retry connecting to the user instantly!!!`,
      "both"
    );
    peer.on("connection", async (connection) => {
      conn = connection;
      console.log("Receiver connection established");
      await setupVideoCall();
      conn.off("data"); // Remove existing listeners to prevent duplication
      conn.on("data", (data) => {
        console.log("Received data:", data);
        if (data.type === "file") {
          handleFileReceived(data);
        } else if (data.type === "message") {
          appendMessage("Peer", data.content);
        }
      });

      conn.on("error", async (err) => {
        console.error("Connection error:", err);
        await reconnectHandler();
      });

      conn.on("close", async () => {
        console.log("Connection closed");
        await reconnectHandler();
      });
    });
  }
  if (conn) {
    conn.on("error", async () => {
      console.error(
        "Connection with the loop user failed,will try to reconnect. error:"
      );
      await reconnectHandler();
    });
  }
}

// async function setupConnectionHandlers(connection) {}

function handleFileReceived(data) {
  const blob = new Blob([data.data]);
  const fileUrl = URL.createObjectURL(blob);
  appendMessage(
    "peer-file",
    `Received a file: ${data.filename}
     <div class="message-actions">
      <button class="view-file-btn" data-url="${fileUrl}">View</button>
      <a href="${fileUrl}"  download="${data.filename}" class="download-btn">Download</a>
    </div>
  </div>`
  );
}

function appendMessage(sender, content) {
  const chatMessages = document.getElementById("chat-messages");
  const newMessage = document.createElement("div");
  newMessage.classList.add("message");
  const messageContent = document.createElement("p");
  messageContent.classList.add("message-text");
  if (sender === "You") {
    newMessage.classList.add("sent");
    messageContent.innerHTML = content;
    newMessage.appendChild(messageContent);
  } else if (sender === "Peer") {
    newMessage.classList.add("received");
    messageContent.innerHTML = content;
    newMessage.appendChild(messageContent);
  } else {
    newMessage.classList.add("received");
    newMessage.innerHTML = content;
  }
  chatMessages.appendChild(newMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setDynamicHeightResize() {
  console.log("dynamic height resize function inititiated");
  const mediaSectionContainer = document.querySelector(
    ".media-section-container"
  );
  const topOffset = mediaSectionContainer.getBoundingClientRect().top;
  const availableHeight = window.innerHeight - topOffset - 5;
  mediaSectionContainer.style.height = `${availableHeight}px`;
  const remoteVidElement = document.getElementById("remote-video");
  remoteVidElement.style.height = "95%";
  remoteVidElement.style.maxHeight = "95%";
  const chatContainer = document.querySelector(".chat-container");
  chatContainer.style.height = "97%";
  chatContainer.style.maxHeight = "97%";
}

function toggleUI() {
  const statusBar = document.querySelector(".status-bar");
  const mediaSection = document.querySelector(".media-section-container");
  const divider = document.querySelector(".white-line");
  const popupOverlay = document.querySelector("#popupOverlay");

  statusBar.classList.toggle("hidden");
  divider.classList.toggle("hidden");
  mediaSection.classList.toggle("hidden");
  popupOverlay.classList.toggle("show");
}

function popUpDisplay(title, content, element) {
  const popupTitle = document.getElementById("popup-title");
  const popupBody = document.getElementById("popup-body");
  popupTitle.innerHTML = title;
  popupBody.innerHTML = content;
  if (element === "loader") {
    //show the loader animation and hide the refresh button
    document.querySelector(".loader").classList.remove("hidden");
    document.getElementById("refresh-btn").classList.add("hidden");
  } else if (element === "refreshbtn") {
    //show the refresh button and hide the loader animation
    document.querySelector(".loader").classList.add("hidden");
    document.getElementById("refresh-btn").classList.remove("hidden");
  } else {
    //show both the refresh button and the loader animation
    document.querySelector(".loader").classList.remove("hidden");
    document.getElementById("refresh-btn").classList.remove("hidden");
  }
}

/* function failureHandler() {
  //this function is called whenever any failure happens like network/user not present/etc so we give a failure message along with a retry button
  popUpDisplay(
    "Failed to connect to the user",
    "Pls click the refresh button to retry!!!",
    "refresh"
  );
  toggleUI();
} */
async function reconnectHandler() {
  popUpDisplay(
    "Failed to connect to the user",
    "Click the refresh button to try again...",
    "refreshbtn"
  );
}
const refreshBtns = document.querySelectorAll(".refresh-btn");
refreshBtns.forEach((button) => {
  button.addEventListener("click", () => {
    popUpDisplay(
      "Reconnecting to the server",
      "Wait a few seconds...",
      "loader"
    );
    //now we will reset the value of the refreshCount so that the peer.on("error",...) can again start executing its if-block instead of the else block
    refreshCount = 0;
    //try to reconnect to the user once and after that the peer.on("error",...) will takeover for further handling...
    peer.disconnect();
    peer.reconnect();
  });
});

/*async function handleDisconnectEvent() {
  //handling the condition when one of the users ends the connection
  if (role === "sender") {
    console.log(
      "hi from the handledisconnect event ...the receiver has disconnected!!!"
    );
    //calling reconnect handler so as to show-up the refresh button along with popup
    //await reconnectHandler();
  } else {
    console.log("the sender has disconnected!!!");
    //load the simple waiting popup if the user is a receiver
    popUpDisplay(
      "Your loop buddy got disconnected from the call!!!",
      "waiting for loop-buddy to reconnect....",
      "refreshbtn"
    );
  }
} */
// New function to set up video call
async function setupVideoCall() {
  console.log("videocalling the buddy...");
  try {
    // Sender side call
    const call = peer.call(receiverPeerID, localStream);
    call.on("stream", async (remoteStream) => {
      await initialiseRemoteStream(remoteStream);
    });
    call.on("error", async (error) => {
      console.error("Call setup error:", error);
      throw new Error("Call setup error:");
    });

    call.on("close", async () => {
      console.warn("Remote video call closed");
      throw new Error("Remote video call closed");
    });

    // Receiver side call handler
    peer.on("call", (incomingCall) => {
      try {
        incomingCall.answer(localStream);
        incomingCall.on("stream", async (remoteStream) => {
          await initialiseRemoteStream(remoteStream);
        });

        incomingCall.on("error", async (error) => {
          console.error("Incoming call error:", error);
          await reconnectHandler();
          throw new Error("Incoming call error:");
        });

        incomingCall.on("close", async () => {
          console.warn("Incoming video call closed");
          await reconnectHandler();
          throw new Error("Incoming video call closed");
        });
      } catch (answerError) {
        console.error("Error answering incoming call:", answerError);
        throw new Error("Error answering incoming call:");
      }
    });
  } catch (setupError) {
    console.error("Video call setup error:", setupError);
    throw new Error("Video call setup error:");
  }
}
// New function to get user media and set up local video
async function initialiseLocalStream() {
  console.log("local video stream initialised");
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    localVideo.srcObject = localStream;
    localVideo.play();
    return true;
  } catch (error) {
    console.error("Error accessing media devices:", error);
    popUpDisplay(
      "Media Access Error",
      "Could not access camera or microphone. Video call will be disabled.",
      "refreshbtn"
    );
    return false;
  }
}
async function initialiseRemoteStream(remoteStream) {
  console.log("Incoming remote stream received");
  remoteVideo.srcObject = remoteStream;
  remoteVideo.play();
  monitoredConnection.status = true;
}
async function getElementDimension(element) {
  if (!element || !(element instanceof HTMLElement)) {
    throw new Error(
      "Invalid element passed. Please provide a valid HTML element."
    );
  }
  const dim = {};
  dim.width = element.offsetWidth; //all in pixels
  dim.height = element.offsetHeight;
  console.log("value of dim is", dim);
  return dim;
}
//rough work herer
// Add video control functions
function toggleVideoStream() {
  const videoTracks = localStream.getVideoTracks();
  videoTracks.forEach((track) => {
    track.enabled = !track.enabled;
  });
}

function toggleAudioStream() {
  const audioTracks = localStream.getAudioTracks();
  audioTracks.forEach((track) => {
    track.enabled = !track.enabled;
  });
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
