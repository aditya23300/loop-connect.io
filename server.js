const express = require("express");
const app = express();
const path = require("path");
const cors = require("cors");
const {
  authMiddleware,
  roomAuthMiddleware,
} = require("./backend/middlewares/authMidddleware");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const {
  postGoogleSignInRouteHandler,
  CRUDFirestoreDB,
  trimUntilFirstSpace,
  createLoopHandler,
  getCreatedLoopsData,
  getIncomingLoopsData,
} = require("./backend/services/data-services");
// Load environment variables from .env file
require("dotenv").config();
//middlewares
//allowing direct access to the views folder so as to send files from here
app.use(express.static(path.join(__dirname, "views")));
// middleware to Serve static files from root directory
app.use(express.static(path.join(__dirname)));
// Set EJS as the view engine so as use the EJS
app.set("view engine", "ejs");
app.use(cors());
app.use(express.json());
app.use(bodyParser.json()); //to parse json content
app.use(cookieParser()); //to parse cookies
app.get("/dashbd/room", (req, res) => {
  res.render("html/room", { userInfo });
});
//dashboard route:::::::::::::
app.get("/dashbd/home", authMiddleware, async (req, res) => {
  try {
    const uid = req.user.uid;
    const response = await CRUDFirestoreDB("get", uid, {});
    if (response.status === "success") {
      const userInfo = response.message;

      //i have to modify the username to pick only the first name
      userInfo.username = trimUntilFirstSpace(userInfo.username);
      // Render the dashboard.ejs file and pass userInfo as data
      res.render("html/dashbd-home", { userInfo });
    } else {
      res.redirect("/");
    }
  } catch (error) {
    console.log(error);
    res.redirect("/");
  }
});
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views/html", "index.html"));
});
// Route handler for the oauthsignin:::::::::::::::::::::::::::::
app.post("/postGoogleSignInRoute", async (req, res) => {
  console.log("request received on postGoogleSignInRoute");
  //update cloudstoredb of user ---> set cookies here ----> send back the status along with a status code
  const userInfo = req.body;
  try {
    const result = await postGoogleSignInRouteHandler(userInfo);
    if (result.status === "success") {
      const token = jwt.sign(
        {
          email: userInfo.email,
          uid: userInfo.uid,
          username: userInfo.displayName,
          loopID: result.userInfo.loopID,
        },
        process.env.JWT_SECRET
      );
      res.cookie("loopAuthToken", token, {
        httpOnly: true, // Helps prevent XSS attacks
        secure: process.env.NODE_ENV === "production", // Use secure cookies in production
        sameSite: "Strict", // Prevent cross-site cookie usage
      });
      console.log("signing in successfull");
      res.status(200).json({ success: true });
    } else {
      console.log("error1 in postgooglesignroute");
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.log("error2 in postgooglesignroute in catch block", error);
    res
      .status(400)
      .json({ success: false, message: "Something went wrong", error });
  }
});
app.post("/createLoopSession", authMiddleware, async (req, res) => {
  try {
    const data = req.body;
    const userInfo = req.user;
    const response = await createLoopHandler(data, userInfo);
    res.json(response);
  } catch (error) {
    res.json({ status: "failure", message: error });
  }
});
app.get("/getCreatedLoopsData", authMiddleware, async (req, res) => {
  try {
    const userInfo = req.user;
    const response = await getCreatedLoopsData(userInfo);
    res.json(response);
  } catch (error) {
    res.json({ status: "failure", message: error });
  }
});
app.get("/getIncomingLoopsData", authMiddleware, async (req, res) => {
  try {
    const userInfo = req.user;
    const response = await getIncomingLoopsData(userInfo);
    res.json(response);
  } catch (error) {
    res.json({ status: "failure", message: error });
  }
});
app.get("/loopRooms", authMiddleware, roomAuthMiddleware, async (req, res) => {
  try {
    const userInfo = req.user;
    res.render("html/room", { userInfo });
  } catch (error) {
    console.log(error);
    res.redirect("/");
    //return the failure 404 not found page
  }
});
app.get("/setupRoom", authMiddleware, roomAuthMiddleware, async (req, res) => {
  try {
    const userInfo = req.user;
    const loopID = userInfo.loopID;
    const roomInfo = req.roomInfo;
    let role = "";
    if (loopID === roomInfo.senderLID) {
      //it means the user is the sender,i.e creator of this loop-session
      role = "sender";
    } else if (loopID === roomInfo.receiverLID) {
      //it means the user is the receiver,i.e the sender created the loop session for this receiver
      role = "receiver";
    } else {
      res.json({ status: "failed" });
    }
    res.json({ status: "success", roomInfo, role, userInfo });
  } catch (error) {
    console.log(error);
    res.json({ status: "failed" });
    //return the failure 404 not found page
  }
});
// Logout route to clear the cookie and redirect...
app.get("/logout", (req, res) => {
  try {
    // Clear the cookie...
    res.clearCookie("loopAuthToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    });
    // Explicitly set cookie expiration
    res.cookie("loopAuthToken", "", {
      expires: new Date(0),
      httpOnly: true,
    });
    console.log("successfully logged out!!! ");
    res.json({ status: "success" });
  } catch (error) {
    console.log("failed to logout!!! ");
    res.json({ status: "failed" });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server is running on PORT: ${PORT}`);
});
