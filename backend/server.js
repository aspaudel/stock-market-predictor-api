const express = require("express");
const cors = require("cors");
const redis = require("redis");
const { spawn } = require("child_process");
const async = require("async");

const app = express();

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
