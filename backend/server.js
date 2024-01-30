const express = require("express");
const cors = require("cors");
const redis = require("redis");
const { spawn } = require("child_process");
const async = require("async");

const app = express();

const predictionResponse = [
  { date: "02-10-23", price: 100.25 },
  { date: "03-10-23", price: 101.5 },
  { date: "04-10-23", price: 103.75 },
  { date: "05-10-23", price: 105.2 },
  { date: "06-10-23", price: 106.8 },
  { date: "07-10-23", price: 107.45 },
  { date: "08-10-23", price: 106.9 },
  { date: "09-10-23", price: 108.7 },
  { date: "10-10-23", price: 110.25 },
  { date: "11-10-23", price: 112.8 },
  { date: "12-10-23", price: 113.55 },
  { date: "13-10-23", price: 115.0 },
  { date: "14-10-23", price: 116.2 },
  { date: "15-10-23", price: 117.3 },
  { date: "16-10-23", price: 118.4 },
  { date: "17-10-23", price: 119.5 },
  { date: "18-10-23", price: 120.75 },
  { date: "19-10-23", price: 122.1 },
  { date: "20-10-23", price: 123.25 },
  { date: "21-10-23", price: 124.6 },
  { date: "22-10-23", price: 126.0 },
  { date: "23-10-23", price: 127.3 },
  { date: "24-10-23", price: 128.6 },
  { date: "25-10-23", price: 129.8 },
  { date: "26-10-23", price: 131.0 },
  { date: "27-10-23", price: null },
  { date: "28-10-23", price: null },
  { date: "29-10-23", price: null },
  { date: "30-10-23", price: null },
  { date: "31-10-23", price: null },
  { date: "01-11-23", price: null },
  // { date: "27-10-23", price: 132.2 },
  // { date: "28-10-23", price: 133.4 },
  // { date: "29-10-23", price: 134.6 },
  // { date: "30-10-23", price: 135.8 },
  // { date: "31-10-23", price: 137.0 },
  // { date: "01-11-23", price: 138.2 },
  { date: "02-11-23", price: 139.4 },
];

const pythonScriptPath = "./python_test.py";

app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

const redisClient = redis.createClient();

app.get("/getPrediction", (req, res) => {
  console.log("Reached");
  console.log(req.query);
  let { stockSymbol, stockIndex } = req.query;
  if (stockIndex === "NSE") {
    stockSymbol += ".NS";
  }
  console.log(stockSymbol);
  async.series(
    [
      function (callback) {
        redisClient.exists(stockSymbol, (err, exists) => {
          if (err) {
            console.error("Redis error: ", err);
            callback(err);
          } else if (exists) {
            console.log("Cache Hit");
            redisClient.get(stockSymbol, (err, value) => {
              if (err) {
                console.error("Redis Error: ", err);
                callback(err);
              } else {
                res.json(value);
              }
            });
          } else {
            callback(null, null);
          }
        });
      },
      function (callback) {
        generatePrediction(stockSymbol)
          .then((result) => {
            console.log("Result");
            console.log(result);
            redisClient.set(stockSymbol, result, (err) => {
              if (err) {
                console.error("Redis error:", err);
                callback(err);
              } else {
                console.log("Cache Miss");
                res.json(result);
              }
            });
          })
          .catch((err) => {
            console.error("Python script encountered an error: " + err);
            callback(err);
          });
      },
    ],
    function (err) {
      if (err) {
        res.status(500).end();
      }
    }
  );
});

function generatePrediction(stockSymbol) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python3", [pythonScriptPath, stockSymbol]);
    let res = "";

    pythonProcess.stdout.on("data", (data) => {
      let jsonString = data.toString();
      console.log(1);
      jsonString = jsonString.replace(/: NaN/g, ": null");
      console.log(jsonString);
      res = jsonString;
      console.log(`Python script stdout: ${data}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error(`Python script stderr: ${data}`);
    });

    pythonProcess.on("close", (code) => {
      console.log(`Python script process exited with code ${code}`);
      if (code === 0) {
        console.log("Success");
        resolve(res);
      } else {
        reject(`Python script process exited with non-zero code: ${code}`);
      }
    });
  });
}

app.listen(3001, () => {
  console.log("Serving App");
});
