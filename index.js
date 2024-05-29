const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 9000;

const app = express();

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://volunteer-e5e10.web.app",
    "https://volunteer-e5e10.firebaseapp.com"
  ],
  credentials: true, //confused
  optionSuccessStatus: 200, //confused
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// verifyToken
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "unauthorized access" });
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.log(err);
        return res.status(401).send({ message: "unauthorized access" });
      }
      console.log(decoded);
      req.user = decoded;
    });
  }
  next();
};

const cookieOption = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" ? true : false,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nl88zl6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Database Collections
    const volunteerCollection = client
      .db("Volunteer")
      .collection("AddedVolunteer");
    const beaVolCollection = client.db("Volunteer").collection("BeAVolunteer");

    // ! jwt generate
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      res
        .cookie("token", token, cookieOption)
        .send({ success: true });
    });

    // Clear token on logout
    app.get("/logout", (req, res) => {
      res
        .clearCookie("token", {...cookieOption, maxAge: 0})
        .send({ success: true });
    });

    // ! Get all volunteers data from db
    app.get("/volunteer", async (req, res) => {
      const result = await volunteerCollection
        .find()
        .sort({ Deadline: -1 })
        .toArray();
      res.send(result);
    });

    // ! Get a single volunteer data from db using volunteer id
    app.get("/volunteer/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await volunteerCollection.findOne(query);
      res.send(result);
    });

    // ! update a single volunteer data from db using be a volunteer id
    app.get("/update/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await volunteerCollection.findOne(query);
      res.send(result);
    });

    // ! Get all volunteers posted by a specific user
    app.get("/volunteers/:email", verifyToken, async (req, res) => {
      const tokenEmail = req.user.email;
      const email = req.params.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { "buyer.email": email };
      const result = await volunteerCollection.find(query).toArray();
      res.send(result);
    });

    // ! Save a volunteers data in database
    app.post("/volunteerpost", async (req, res) => {
      const volunteerData = req.body;
      const result = await volunteerCollection.insertOne(volunteerData);
      res.send(result);
    });

    // ! update a volunteer data from db
    app.put("/update/:id", async (req, res) => {
      const id = req.params.id;
      const volunteerData = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...volunteerData,
        },
      };
      const result = await volunteerCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });

    // ! Delete a volunteer data from db
    app.delete("/volunteers/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await volunteerCollection.deleteOne(query);
      res.send(result);
    });

    // be vollunteer

    // ! Save a be a vollunteer data in database
    app.post("/beavollunteer", async (req, res) => {
      const bidData = req.body;
      const result = await beaVolCollection.insertOne(bidData);
      res.send(result);
    });

    // ! Get be a volunteer data from db using be a volunteer id
    app.get("/be-a-volunteer/:email", verifyToken, async (req, res) => {
      const tokenEmail = req.user.email;
      const email = req.params.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email };
      const result = await beaVolCollection.find(query).toArray();
      res.send(result);
    });

    // ! Cencel a volunteer data from db
    app.delete("/req-volunteer/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await beaVolCollection.deleteOne(query);
      res.send(result);
    });

    app.get('/applied-post', async(req, res)=>{
      const query = req.body;
      const result = await beaVolCollection.find(query).toArray();
      res.send(result);
    })

    // ! Get all volunteers data from db for pagination
    app.get("/all-volunteer", async (req, res) => {
      const size = parseInt(req.query.size) || 10;
      console.log(size);
      const page = parseInt(req.query.page) || 6;
      const search = req.query.search || "";
      const filter = req.query.filter || "";
      let query = {
        title: { $regex: search, $options: "i" },
      };
      if (filter) query.category = filter;
      let options = {};
      const result = await volunteerCollection
        .find(query, options)
        .skip((page - 1) * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    // ! Get all volunteers data count from db for pagination
    app.get("/volunteer-count", async (req, res) => {
      const search = req.query.search;
      const filter = req.query.filter;
      let query = {
        title: { $regex: search, $options: "i" },
      };
      if (filter) query.category = filter;
      try {
        const count = await volunteerCollection.countDocuments(query);
        res.send({ count });
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from SoloSphere Server....");
});

app.listen(port, () => console.log(`Server runnign on port ${port}`));
