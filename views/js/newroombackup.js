let peer,
  conn,
  senderPeerID,
  receiverPeerID,
  connectionStatus = { status: false, message: "" },
  monitoredConnection,
  refreshCount = 0,
  localStream,
  remoteStream,
  screenStream,
  mediaCall;

document.addEventListener("DOMContentLoaded", async () => {
  // Get UI elements
  const hamburger = document.getElementById("hamburger");
  const navList = document.getElementById("nav-list");
  const sendBtn = document.getElementById("sendMessage");
  const msgInput = document.getElementById("messageInput");
  const videoGrid = document.getElementById("video-grid");
  const screenShareBtn = document.getElementById("screenShare");
  const fileInput = document.getElementById("fileInput");

  // Media constraints
  const mediaConstraints = {
    video: true,
    audio: true,
  };

  // Proxy setup for connection monitoring
  const handler = {
    set(target, key, value) {
      if (key === "status" && target[key] !== value) {
        console.log(`Status changed to: ${value}`);
        if (value) {
          console.log("Connection established");
          initializeMediaStream();
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
  popUpDisplay("Setting up loop-room!!", "Please wait a few seconds!");
  toggleUI();
  await roomInitialiser();

  // Initialize media stream
  async function initializeMediaStream() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      addVideoStream(createVideo(true), localStream);
    } catch (err) {
      console.error("Failed to get media stream:", err);
    }
  }

  // Helper function to create video element
  function createVideo(muted) {
    const video = document.createElement("video");
    video.classList.add("media-box");
    video.muted = muted;
    return video;
  }

  // Helper function to add video stream
  function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", () => {
      video.play();
    });
    videoGrid.appendChild(video);
  }

  // Screen sharing functionality
  screenShareBtn.addEventListener("click", async () => {
    try {
      if (!screenStream) {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        if (mediaCall) {
          const videoTrack = screenStream.getVideoTracks()[0];
          const sender = mediaCall.peerConnection
            .getSenders()
            .find((s) => s.track.kind === "video");
          sender.replaceTrack(videoTrack);
        }
        screenShareBtn.textContent = "Stop Sharing";
      } else {
        const videoTrack = localStream.getVideoTracks()[0];
        const sender = mediaCall.peerConnection
          .getSenders()
          .find((s) => s.track.kind === "video");
        sender.replaceTrack(videoTrack);
        screenStream.getTracks().forEach((track) => track.stop());
        screenStream = null;
        screenShareBtn.textContent = "Share Screen";
      }
    } catch (err) {
      console.error("Error during screen sharing:", err);
    }
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

  // Text chat functionality
  sendBtn.addEventListener("click", sendMessage);
  msgInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

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

  // Error handling
  peer.on("error", (err) => {
    console.error("PeerJS error:", err);
    if (
      (err.type === "network" || err.type === "peer-unavailable") &&
      refreshCount <= 10
    ) {
      refreshCount++;
      peer.disconnect();
      peer.reconnect();
    } else if (refreshCount > 10) {
      popUpDisplay(
        "Failed to connect to the user",
        "Please click the retry button"
      );
    }
  });

  hamburger.addEventListener("click", () => {
    navList.classList.toggle("active");
  });
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

      // Initialize PeerJS connection
      peer = new Peer(newResponse.userInfo.loopID, {
        host: "localhost",
        port: 9000,
        path: "/peerjs",
        debug: 3,
      });

      // Set up peer event handlers
      peer.on("open", () => {
        console.log("Connected to PeerJS server");
        createConnection(newResponse);
      });

      peer.on("error", (error) => {
        console.error("Peer connection error:", error);
        popUpDisplay("Connection Error", "Failed to connect to peer server");
      });

      popUpDisplay(
        "Room setup successfully!!",
        "waiting for other person to join"
      );
    } else {
      console.error("Failed to initialize room setup");
      popUpDisplay(
        "Failed to setup the loop-room",
        "Please click the refresh button or reload the page"
      );
    }
  } catch (error) {
    console.error("Room initialization error:", error);
    popUpDisplay(
      "Error encountered! Failed to setup the loop-room",
      "Please click the refresh button or reload the page"
    );
  }
}

async function createConnection(newResponse) {
  if (newResponse.role === "sender") {
    console.log("Initializing as sender");
    conn = peer.connect(receiverPeerID);

    conn.on("open", () => {
      console.log("Sender connection established");
      monitoredConnection.status = true;
      setupConnectionHandlers(conn);

      // Initialize call after media stream is ready
      if (localStream) {
        initiateCall();
      } else {
        const checkStreamInterval = setInterval(() => {
          if (localStream) {
            initiateCall();
            clearInterval(checkStreamInterval);
          }
        }, 1000);
      }
    });
  } else {
    console.log("Initializing as receiver");
    peer.on("connection", (connection) => {
      conn = connection;
      console.log("Receiver connection established");
      monitoredConnection.status = true;
      setupConnectionHandlers(conn);
    });

    peer.on("call", async (call) => {
      console.log("Receiving call");
      mediaCall = call;

      // Ensure we have local stream before answering
      if (!localStream) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          addVideoStream(createVideo(true), localStream);
        } catch (err) {
          console.error("Failed to get local stream:", err);
          return;
        }
      }

      call.answer(localStream);
      setupCallHandlers(call);
    });
  }
}

function setupConnectionHandlers(connection) {
  connection.on("data", (data) => {
    console.log("Received data:", data);
    if (data.type === "file") {
      handleFileReceived(data);
    } else if (data.type === "message") {
      appendMessage("Peer", data.content);
    }
  });

  connection.on("error", (err) => {
    console.error("Connection error:", err);
    monitoredConnection.status = false;
  });

  connection.on("close", () => {
    console.log("Connection closed");
    monitoredConnection.status = false;
  });
}

function setupCallHandlers(call) {
  call.on("stream", (stream) => {
    console.log("Received remote stream");
    remoteStream = stream;
    addVideoStream(createVideo(false), stream);
  });

  call.on("close", () => {
    console.log("Call ended");
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
    }
    const videos = document.querySelectorAll("#video-grid video");
    videos.forEach((video) => {
      if (video.srcObject !== localStream) {
        video.remove();
      }
    });
  });

  call.on("error", (error) => {
    console.error("Call error:", error);
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
    }
  });
}

function handleFileReceived(data) {
  const blob = new Blob([data.data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = data.filename;
  a.click();
  URL.revokeObjectURL(url);

  appendMessage("Peer", `Sent a file: ${data.filename}`);
}

function appendMessage(sender, content) {
  const chatMessages = document.getElementById("chat-messages");
  const newMessage = document.createElement("p");
  newMessage.innerHTML = `<b>${sender}:</b> ${content}`;
  chatMessages.appendChild(newMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function initiateCall() {
  if (localStream) {
    console.log("Initiating call to:", receiverPeerID);
    mediaCall = peer.call(receiverPeerID, localStream);
    setupCallHandlers(mediaCall);
  } else {
    console.error("Cannot initiate call without local stream");
  }
}

// Utility functions
function setDynamicHeight() {
  const mediaSectionContainer = document.querySelector(
    ".media-section-container"
  );
  const topOffset = mediaSectionContainer.getBoundingClientRect().top;
  const availableHeight = window.innerHeight - topOffset - 5;
  mediaSectionContainer.style.height = `${availableHeight}px`;
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

function popUpDisplay(title, content) {
  const popupTitle = document.getElementById("popup-title");
  const popupBody = document.getElementById("popup-body");
  popupTitle.innerHTML = title;
  popupBody.innerHTML = content;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Add event listeners for dynamic height adjustment
window.addEventListener("load", setDynamicHeight);
window.addEventListener("resize", setDynamicHeight);
