const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();
const { MongoClient } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
//doctors-portal-firebase-adminsdk.json

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const e = require("express");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function verifyToken(req, res, next) {
  //checking if there is any token=firstly
  if (req?.headers?.authorization?.startsWith("Bearer ")) {
    //splitting it into any array taking the 1th index
    const token = req.headers.authorization.split(" ")[1];
    //verify jwt token
    try {
      //if its verified it would return the data inside it.
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

//middleware
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.072tx.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
async function run() {
  try {
    await client.connect();
    const database = client.db("doctors-portal");
    const appointmentCollection = database.collection("appointments");
    const usersCollection = database.collection("users");
    //GET API
    app.get("/appointments", async (req, res) => {
      const email = req.query.email;
      //converting from string to objct using new date
      const date = new Date(req.query.date).toLocaleDateString();
      //console.log(date);
      const query = { email: email, date: date };
      // console.log(query);
      const cursor = appointmentCollection.find(query);
      const appointments = await cursor.toArray();
      res.send(appointments);
    });
    //POST API
    app.post("/appointments", verifyToken, async (req, res) => {
      const appointment = req.body;
      const result = await appointmentCollection.insertOne(appointment);
      res.json(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });
    //verify the admin using email
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }

      res.json({ admin: isAdmin });
    });
    //upsert ->update+insert->if the data exists in db we will not insert the data, if the data dont exist we will insert the data.
    //put api
    app.put("/users", async (req, res) => {
      const user = req.body;
      //console.log("put", user);
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };

          const updateDoc = { $set: { role: "admin" } };

          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(403)
          .json({ message: "you do not have the access to make admin" });
      }
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("doctor portal server running");
});
app.listen(port, () => {
  console.log("listening to port", port);
});
