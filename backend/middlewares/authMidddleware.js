//middleware for all protected routes should be like::: check if cookie is present in the browser, if yes then np else redirect the user from protected routes back to the homepage
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { getRoomInfo } = require("../services/data-services");
function authMiddleware(req, res, next) {
  const token = req.cookies.loopAuthToken;
  if (!token) {
    console.log("action: Cookie not found. redirecting to login page!!!");
    return res.redirect("/");
  }
  try {
    //this decoded variable contains the payload we used to create the jwt token, inshort it is coverting the token back to the payload aka decryption, if the token is found to be invalid then the verify function will return error so control will then goto catch block.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    //this will execute when the verify method returns error ie cookie is tampered...
    console.log("action: Invalid Cookie. redirecting to login page!!!");
    return res.redirect("/");
  }
}
async function roomAuthMiddleware(req, res, next) {
  try {
    //adding the condition so that the room is accessible to only the sender or the receiver
    const loopRoomID = req.query.roomID;
    let roomInfo = await getRoomInfo(loopRoomID);
    if (roomInfo.status === "failed") {
      //error getting roominfo .either no room exists or firebase server is down,so just redirect back to homepage
      console.log("error getting room-info", roomInfo.message);
      return res.redirect("/");
    }
    roomInfo = roomInfo.message;
    if (
      !(
        req.user.loopID === roomInfo.receiverLID ||
        req.user.loopID === roomInfo.senderLID
      )
    ) {
      console.log("Invalid user access to the room, redirecting to homepage");
      return res.redirect("/");
    }
    req.roomInfo = roomInfo; //attaching the room-info to the request as its needed further
    return next();
  } catch (error) {
    console.log(
      `Error: ${error} . Room authorisation check failed!!!.\n Redirecting to homepage.`
    );
    return res.redirect("/");
  }
}
module.exports = { authMiddleware, roomAuthMiddleware };
