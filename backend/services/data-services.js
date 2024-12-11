const { db } = require("../configs/firebase-admin-config");
const crypto = require("crypto");
const { FieldValue } = require("../configs/firebase-admin-config");

async function postGoogleSignInRouteHandler(userInfo) {
  try {
    //first we will check if the user who signed currently is an old or a new user, depending on that we will update the db
    const userChecker = await CRUDFirestoreDB("get", userInfo.uid, {});

    if (userChecker.status === "success") {
      //it means the user already exists so we will update the username and the photoURL fields as email,uid are permanent and remain same for a specific user
      const dbUpdate = await CRUDFirestoreDB("update", userInfo.uid, {
        username: userInfo.displayName,
        photoURL: userInfo.photoURL,
      });
      if (dbUpdate.status === "success") {
        dbUpdate.message = "Updated the details of old user successfully.";
        dbUpdate.userInfo = userChecker.message;
      } else {
        dbUpdate.message = "Unable to update the details of the old user";
      }
      return dbUpdate;
    } else {
      //it means its a new user so create a new document in firestore db and initialise the values....
      //first we will create a unique 7-digit loopID for the user...
      let loopID = await generateUniqueId(4);
      loopID = "l" + loopID + userInfo.uid.substring(userInfo.uid.length - 1);

      const setDetails = await CRUDFirestoreDB("set", userInfo.uid, {
        username: userInfo.displayName,
        email: userInfo.email,
        photoURL: userInfo.photoURL,
        uid: userInfo.uid,
        loopID: loopID,
        createdLoops: [],
        incomingLoopRequests: [],
      });
      const userData = await CRUDFirestoreDB("get", userInfo.uid, {});
      if (setDetails.status === "success" && userData.status === "success") {
        setDetails.userInfo = userData.message;
        setDetails.message =
          "Successfully initialised the firestoredb for the new user";
      } else {
        setDetails.message =
          "Failed to initialise the firestoredb for the new user";
      }
      return setDetails;
    }
  } catch (error) {
    console.log("Error creating new user:", error.message);
    return { status: "failed", message: error.message }; // Return error message
  }
}
//function to perform any of the CRUD operations ,,currently set,get,update are available.
async function CRUDFirestoreDB(action, uid, updationObject) {
  try {
    const userRef = db.collection("users").doc(uid);

    if (action === "set") {
      await userRef.set(updationObject);
    } else if (action === "update") {
      await userRef.update(updationObject);
    } else if (action === "get") {
      const doc = await userRef.get();
      if (doc.exists) {
        return { status: "success", message: doc.data() };
      } else {
        return { status: "failed", message: "Document not found" };
      }
    }
    return {
      status: "success",
      message: `successfully performed the ${action} operation on the firestoreDB.`,
    };
  } catch (error) {
    console.log(error);
    return {
      status: "failed",
      message: `failed to perform the ${action} on the firestoreDB `,
    };
  }
}
async function activeRoomUpdate(loopRoomObj) {
  try {
    // Reference to your collection
    const collectionRef = db.collection("activeLoops");
    // Add the document to the collection
    await collectionRef.doc(loopRoomObj.loopRoomID).set(loopRoomObj);
    return {
      status: "success",
      message:
        "successfully updated the loopRoomOBj to the activeLoops collection",
    };
  } catch (error) {
    return {
      status: "failed",
      message: `Error : ${error} .\n Failed to update the loopRoomOBj to the activeLoops collection`,
    };
  }
}
//function to extract the first name from the whole username
function trimUntilFirstSpace(str) {
  const firstSpaceIndex = str.indexOf(" ");
  if (firstSpaceIndex === -1) {
    // If there is no space, return the entire string
    return str;
  }
  return str.substring(0, firstSpaceIndex);
}

async function createLoopHandler(data, userInfo) {
  try {
    //first check whether the receiver exists or not
    const validLoopIDChecker = await LoopIDChecker(data.receiverLID);
    if (validLoopIDChecker.status === "failed") return validLoopIDChecker;
    if (userInfo.loopID === data.receiverLID)
      return {
        status: "failed",
        message:
          "You have entered your own loopID,instead pls enter the loopID of the person with whom you want to interact in the loop session.",
      };
    //get the current time to set the loop-room creation time
    const currentDate = new Date();
    //create a unique 6 digits LoopRoomID which can be used to uniquely identify any particular loop-room
    const loopRoomID = await generateUniqueId(6);
    //create a loop-room object which stores all the important details about the particular loop-room
    const loopRoomObj = {
      loopRoomID,
      senderLID: userInfo.loopID,
      receiverLID: data.receiverLID,
      roomCreationTime: currentDate,
    };

    //now, add the loopRoomID to the 'users' collection's createdloop array
    const usersdbUpdate = await CRUDFirestoreDB("update", userInfo.uid, {
      createdLoops: FieldValue.arrayUnion(loopRoomID),
    });
    //now, add the loopRoom obj to the 'activeLoops' collection with doc name=loopRoomID
    const activeLoopsUpdate = await activeRoomUpdate(loopRoomObj);
    //get the details of the receiver using his loopID
    const receiverData = await LoopIDChecker(data.receiverLID);
    //now,we will add the loopRoomId to the incomingLoopRequests array of the receiver
    const loopRequestUpdate = await CRUDFirestoreDB(
      "update",
      receiverData.data.uid,
      {
        incomingLoopRequests: FieldValue.arrayUnion(loopRoomID),
      }
    );
    //now, ensure that both the collections got updated
    if (
      usersdbUpdate.status === "success" &&
      activeLoopsUpdate.status === "success" &&
      loopRequestUpdate.status === "success"
    ) {
      //now,we have created and saved the loopRoom obj, now we will create a custom url for joining the loopRoom
      const loopRoomURL = `http://localhost:3000/loopRooms?roomID=${loopRoomObj.loopRoomID}`;
      return {
        status: "success",
        message: { loopRoomURL, receiverLID: data.receiverLID },
      };
    } else {
      return {
        status: "failed",
        message: "loopid exists but failed to create loopRoom",
      };
    }
  } catch (error) {
    return { status: "failed", message: error };
  }
}
//this function is to check whether the provided loop-id exists or not , if yes then send the obj of that loopid user
async function LoopIDChecker(loopID) {
  try {
    // Reference the collection
    const usersCollection = db.collection("users"); // Replace "users" with your collection name

    // Query for the document with the given loopID
    const querySnapshot = await usersCollection
      .where("loopID", "==", loopID)
      .get();
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0]; // Get the first document
      const data = doc.data(); // Extract its data
      return { status: "success", data }; // Object exists
    } else {
      return { status: "failed", message: "No user with given loopID exists." }; // Object does not exist
    }
  } catch (error) {
    return {
      status: "failed",
      message: `ERROR: ${error}.\n error checking the user with given loopID,pls try again later.`,
    };
  }
}
async function generateUniqueId(length) {
  return crypto.randomBytes(length).toString("hex");
}
async function getRoomInfo(loopRoomID) {
  //console.log("roomid", loopRoomID);
  try {
    const docRef = db.collection("activeLoops").doc(loopRoomID);
    const doc = await docRef.get();
    const docData = doc.data();
    if (!doc.exists) {
      return { status: "failed", message: "No room with given roomID exists" };
    }
    return {
      status: "success",
      message: docData,
    };
  } catch (error) {
    return {
      status: "failed",
      message: `${error} erorr checking the room-info`,
    };
  }
}
async function getCreatedLoopsData(userInfo) {
  try {
    //Get the array of the created roomIDs using the uid of the user
    const response1 = await CRUDFirestoreDB("get", userInfo.uid, {});
    if (response1.status != "success") return response1;
    let createdLoopsInfo = [];
    //get each rooms data from the actveRooms collection and append to the createdroominfo array
    const createdLoopsArray = response1.message.createdLoops;
    for (let i = 0; i < createdLoopsArray.length; i++) {
      const roomData = await getRoomInfo(createdLoopsArray[i]);
      if (!roomData.status === "success") return roomData;
      createdLoopsInfo.push(roomData.message);
    }
    return {
      status: "success",
      message: createdLoopsInfo,
    };
  } catch (error) {
    return {
      status: "failed",
      message: `${error} erorr getting the createdLoops Data.`,
    };
  }
}
async function getIncomingLoopsData(userInfo) {
  try {
    //Get the array of the created roomIDs using the uid of the user
    const response1 = await CRUDFirestoreDB("get", userInfo.uid, {});
    if (response1.status != "success") return response1;
    let incomingLoopsInfo = [];
    //get each rooms data from the actveRooms collection and append to the createdroominfo array
    const incomingLoopsArray = response1.message.incomingLoopRequests;
    for (let i = 0; i < incomingLoopsArray.length; i++) {
      const roomData = await getRoomInfo(incomingLoopsArray[i]);
      if (!roomData.status === "success") return roomData;
      incomingLoopsInfo.push(roomData.message);
    }
    return {
      status: "success",
      message: incomingLoopsInfo,
    };
  } catch (error) {
    return {
      status: "failed",
      message: `${error} erorr getting the createdLoops Data.`,
    };
  }
}
module.exports = {
  CRUDFirestoreDB,
  postGoogleSignInRouteHandler,
  trimUntilFirstSpace,
  createLoopHandler,
  getRoomInfo,
  getCreatedLoopsData,
  getIncomingLoopsData,
};
