//definitions
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
require('dotenv').config();
//mongoose
const mongoose = require("mongoose");
mongoose.connect(
  process.env.MONGO_URI,
  { useNewUrlParser: true, useUnifiedTopology: true }
);
const Schema = mongoose.Schema;

const connection = mongoose.connection;
connection.on('error', console.error.bind(console, 'connection error:'));
connection.once('open', () => {
  console.log("MongoDB database connection established successfully");
})

//Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

//send Index
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

//db stuff
const PersonSchema = new Schema({
  username: String,
  exercise: [
    {
      description: String,
      duration: Number,
      date: {}
    }
  ]
});

var Person = mongoose.model("Person", PersonSchema);

const createPerson = (name, done) => {
  Person.findOne({ username: name }, (err, findData) => {
    if (findData == null) {
      //no user currently, make new
      const person = new Person({ username: name, exercise: [] });
      person.save((err, data) => {
        if (err) {
          done(err);
        }
        done(null, data);
      });
    } else if (err) {
      done(err);
    } else {
      //username taken
      done(null, "taken");
    }
  });
};

const addExercise = (personId, activity, done) => {
  Person.findOne({ _id: personId }, (err, data) => {
    //add to array
    if (data == null) {
      done(null, "notFound");
    } else {
      if (data.exercise.length === 0) {
        data.exercise = data.exercise.concat([activity]);
      } else {
        let mark = "pending";
        for (let i = 0; i < data.exercise.length; i++) {
          if (activity.date.getTime() < data.exercise[i].date.getTime()) {
            data.exercise.splice(i, 0, activity);
            mark = "done";
            break;
          }
        }
        if (mark === "pending") {
          data.exercise = data.exercise.concat([activity]);
        }
      }
      //save
      data.save((err, data) => {
        if (err) {
          console.log(err);
          done(err);
        } else {
          done(null, data);
        }
      });
    }
  });
};

//functions
function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}

//post requests
app.post("/api/exercise/new-user", (req, res) => {
  createPerson(req.body.username, (err, saveData) => {
    if (err) {
      res.send({ error: "Error, Please try again" });
    } else if (saveData === "taken") {
      res.send({ error: "Username already taken" });
    } else {
      res.send({ username: saveData.username, _id: saveData._id });
    }
  });
});

app.post("/api/exercise/add", (req, res) => {
  let dateVar;
  if (req.body.date != "") {
    dateVar = new Date(req.body.date);
  } else {
    dateVar = new Date();
  }

  let activity = {
    description: req.body.description,
    duration: parseInt(req.body.duration),
    date: dateVar
  };
  addExercise(req.body.userId, activity, (err, saveData) => {
    if (err) {
      res.send({ error: "Error, Please try again" });
    } else if (saveData === "notFound") {
      res.send({ error: "User not found" });
    } else {
      res.send({
        _id: saveData._id,
        username: saveData.username,
        date: dateVar.toDateString(),
        duration: activity.duration,
        description: activity.description
      });
    }
  });
});

//get requests
app.get("/api/exercise/log", (req, res) => {
  console.log(req.query);
  Person.findOne({ _id: req.query.userId }, (err, data) => {
    if (data == null) {
      res.send({ error: "User not found" });
    } else {
      //{"_id":"5f19cced95760400a273139b","username":"The_Hyperboy","count":3,
      //"log":[{"description":"abs workout","duration":10,"date":"Fri Jul 24 2020"}]}

      //{"_id":"5f1ab37cb9f2c75ff4392630","username":"hi","exercise":[{"_id":"5f1ab387b9f2c75ff4392631","description":"abs workout","duration":10,"date":"2020-07-23T00:00:00.000Z"}],"__v":1}

      let results = {
        _id: data._id,
        username: data.username,
        count: 0,
        log: data.exercise
      };

      let fromDate = new Date(req.query.from);
      let toDate = new Date(req.query.to);
      let limit = parseInt(req.query.limit);
      //check if to is defined
      if (isValidDate(toDate)) {
        results.log = results.log.filter(
          item =>
            item.date.getTime() >= fromDate.getTime() &&
            item.date.getTime() <= toDate.getTime()
        );
        //check if just from defined
      } else if (isValidDate(fromDate)) {
        results.log = results.log.filter(
          item => item.date.getTime() >= fromDate.getTime()
        );
      }
      //apply limit if defined and applicable
      console.log(limit)
      if (!isNaN(limit) && results.log.length > limit) {
        results.log = results.log.slice(0, limit);
      }
      results.log.forEach(e => (e.date = e.date.toDateString()));
      results.count = results.log.length;
      res.send(results);
    }
  });
});

app.get("/api/exercise/users", (req, res) => {
  Person.find({}, (err, data) => {
    res.json(data);
  });
});
// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

//listener
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
