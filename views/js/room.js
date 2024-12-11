let peer,
  conn,
  senderPeerID,
  receiverPeerID,
  connectionStatus = { status: false, message: "" },
  monitoredConnection, //to keep track of the connection
  refreshCount = 0;
document.addEventListener("DOMContentLoaded", async () => {
  // Get the hamburger menu and nav list elements
  const hamburger = document.getElementById("hamburger");
  const navList = document.getElementById("nav-list");
  const sendBtn = document.getElementById("sendMessage");
  const msgInput = document.getElementById("messageInput");
  //setting up monitoring mechanism for the connectionStatus Object
  const handler = {
    set(target, key, value) {
      // The set trap is triggered when a property is being set.
      if (key === "status" && target[key] !== value) {
        console.log(`Status changed to: ${value}`); // Log when the status changes
        if (value) {
          console.log("Performing action for true..."); // Action when status is true
        } else {
          console.log("Performing action for false..."); // Action when status is false
        }
        toggleUI();
      }
      target[key] = value; // Update the property on the target object
      return true; // Indicate that the operation was successful
    },
  };
  // Creating the Proxy to monitor changes
  monitoredConnection = new Proxy(connectionStatus, handler);
  //load the popup to show "setting-up the loop-room"
  popUpDisplay("Setting up loop-room!!", "pls wait a few seconds!");
  toggleUI();
  //set-up the room by getting necessary details from the backend
  await roomInitialiser();
  // Handle peer errors
  peer.on("error", (err) => {
    console.error("PeerJS error:", err);

    // If the connection was lost, recreate the connection
    if (
      (err.type === "network" || err.type === "peer-unavailable") &&
      refreshCount <= 10
    ) {
      refreshCount++;
      console.log(refreshCount);
      peer.disconnect();
      console.log("Attempting to reconnect...");
      peer.reconnect();
    } else if (refreshCount > 10) {
      popUpDisplay(
        "Failed to connect to the user",
        "pls click the retry button"
      );
    }
  });
  sendBtn.addEventListener("click", () => {
    if (msgInput.value.trim() !== "" && conn && conn.open) {
      conn.send({
        type: "message",
        content: msgInput.value,
      }); // Send the message
      console.log("Message sent:", msgInput.value);
      // Append message to the chat display
      const chatMessages = document.getElementById("chat-messages");
      const newMessage = document.createElement("p");
      newMessage.innerHTML = `<b>You:</b> ${msgInput.value}`;
      chatMessages.appendChild(newMessage);
      chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to the latest message

      msgInput.value = ""; // Clear the input field after sending
    } else {
      console.log("Connection is not open or message input is empty");
    }
  });

  //event listener to handle any error during the conversation
  /* The peer.on("error", (err) => { ... }) method is invoked when an error occurs in the PeerJS connection or any related operations. This event helps to handle unexpected issues during the lifetime of a PeerJS peer instance.*/
  peer.on("error", (err) => {
    console.error("Peer connection error:", err);
    monitoredConnection.status = false;
  });

  // Toggle the active class on the nav list when the hamburger is clicked
  hamburger.addEventListener("click", () => {
    navList.classList.toggle("active");
  });
});
function appendMessage(sender, content) {
  const chatMessages = document.getElementById("chat-messages");
  const newMessage = document.createElement("p");
  newMessage.innerHTML = `<b>${sender}:</b> ${content}`;
  chatMessages.appendChild(newMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;
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
function setDynamicHeight() {
  //all the below calculations are done in pixels...
  const mediaSectionContainer = document.querySelector(
    ".media-section-container"
  );
  const topOffset = mediaSectionContainer.getBoundingClientRect().top; // Get the distance from the top of the viewport to the container

  // Calculate the available height by subtracting the top offset from the viewport height
  const availableHeight = window.innerHeight - topOffset - 5;
  // Set the height of .response-container
  mediaSectionContainer.style.height = `${availableHeight}px`;
}

function toggleUI() {
  const statusBar = document.querySelector(".status-bar");
  const mediaSection = document.querySelector(".media-section-container");
  const divider = document.querySelector(".white-line");
  const popupOverlay = document.querySelector("#popupOverlay");

  // toggle the ui of the buttons
  statusBar.classList.toggle("hidden");
  divider.classList.toggle("hidden");
  mediaSection.classList.toggle("hidden");
  popupOverlay.classList.toggle("show");
}
// event listener to listen to load event:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
window.addEventListener("load", setDynamicHeight);
// event listener to listen to resize event::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
window.addEventListener("resize", setDynamicHeight);
function popUpDisplay(title, content) {
  const popupTitle = document.getElementById("popup-title");
  const popupBody = document.getElementById("popup-body");
  popupTitle.innerHTML = title;
  popupBody.innerHTML = content;
}
async function roomInitialiser() {
  try {
    //get the roomID from the url
    const urlParams = new URLSearchParams(window.location.search);
    // Get the value of a specific query parameter
    const roomID = urlParams.get("roomID");
    //send get request to the backend to get the loopRoomObj needed to set up the room
    const response = await fetch(`/setupRoom?roomID=${roomID}`, {
      method: "GET", // Specify the HTTP method
      headers: {
        "Content-Type": "application/json", // Set headers if needed
      },
    });
    const newResponse = await response.json();
    if (response.ok && newResponse.status === "success") {
      console.log(newResponse);
      //setting the peerid of sender and receiver
      senderPeerID = newResponse.roomInfo.senderLID;
      receiverPeerID = newResponse.roomInfo.receiverLID;
      //initialising the peer to the peer server so that this user is available on the peer-server peers list
      peer = new Peer(newResponse.userInfo.loopID, {
        config: {
          iceServers: [
            // Google's public STUN servers
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
          ],
        },
        host: "/",
        port: 3000,
        path: "/peerjs",
        debug: 3,
      });
      popUpDisplay(
        "Room setup successfully!!",
        "waiting for other person to join"
      );
      await createConnection(newResponse);
      // popUpDisplay("Your client has joined the room!!!", "loading the room");
    } else {
      //setting-up failed
      console.log("failed to initialise the room-setup.");
      popUpDisplay(
        "Failed to setup the loop-room",
        "pls click the refresh button or reload the page yourself"
      );
    }
  } catch (error) {
    console.log(error);
    popUpDisplay(
      "Error encountered!!!Failed to setup the loop-room",
      "pls click the refresh button or reload the page yourself"
    );
  }
}
async function createConnection(newResponse) {
  if (newResponse.role === "sender") {
    //code if the current client is a sender
    /*
 The peer.on("open", () => { ... }) is invoked when the PeerJS client has successfully established a connection to the PeerJS server and has been assigned a unique peer ID.*/
    peer.on("open", (id) => {
      console.log(`My peer ID is: ${id}`);
      /*sending a connection request to the receiver client.
    now,once the receiver accepts the connection request sent, then the "conn" object below will be the reference object to communicate with the other peer.*/
      conn = peer.connect(receiverPeerID);
      // Check if the connection is successfully established
      //the conn.on("open",...) is invoked only if the connection is successfully established .
      conn.on("open", () => {
        console.log("Connection successfully accepted by the receiver!");
        // Perform any actions now that the connection is established
        monitoredConnection.status = true;
      });

      // Handle connection errors
      conn.on("error", (err) => {
        console.error("Connection error:", err);
        monitoredConnection.status = false;
      });
    });
  } else {
    //code if the current client is a sender
    /*The peer.on("connection", () => { ... }) method is invoked when another peer initiates a connection request to the current peer using the peer.connect(peerID) method*/
    peer.on("connection", (connection) => {
      //the parameter of callback-function here will act as reference object for our connection,so store that in a global var named "conn" for further use.
      conn = connection;
      // Set up event handlers immediately for receiver
      setupConnectionHandlers(conn);
      monitoredConnection.status = true;
    });
  }
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function setupConnectionHandlers(connection) {
  // Debug log
  console.log("Setting up connection handlers");

  // Data receiving handler
  connection.on("data", (data) => {
    console.log("Raw received data:", data);
    try {
      let decodedMessage = data.message || data;
      console.log("Received and decoded message:", decodedMessage);

      const chatMessages = document.getElementById("chat-messages");
      const newMessage = document.createElement("p");
      newMessage.innerHTML = `<b>Peer:</b> ${decodedMessage}`;
      chatMessages.appendChild(newMessage);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
      console.error("Error processing received message:", error);
    }
  });

  // Error handler
  connection.on("error", (err) => {
    console.error("Connection error:", err);
    monitoredConnection.status = false;
  });

  // Close handler
  connection.on("close", () => {
    console.log("Connection closed");
    monitoredConnection.status = false;
  });
}
