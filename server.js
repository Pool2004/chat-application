// Importing redis client
// By default the redis client connects to redis instance running at  localhost:6379
const Redis = require("ioredis");
const cluster = require("node:cluster");
const http = require("node:http");
const numCPUs = require("node:os").availableParallelism();
const process = require("node:process");
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
const { Server } = require("socket.io");
const { info } = require("node:console");
const express = require("express");

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);
  const httpServer = http.createServer();
  httpServer.listen(3000);
  // Setting up stick session
  setupMaster(httpServer, {
    loadBalancingMethod: "least-connection",
  });
  // Setting up communication between workers and primary
  setupPrimary();
  cluster.setupPrimary({
    serialization: "advanced",
  });
  // Launching workers based on the number of CPU threads.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  /**
   * Setting up the worker threads
   */
  console.log(`Worker ${process.pid} started`);
  /**
   * Creating Express App and Socket.io Server
   * and binding them to HTTP Server.
   */
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer);
  // Using the cluster socket.io adapter.
  io.adapter(createAdapter());
  // Setting up worker connection with the primary thread.
  setupWorker(io);
  io.on("connection", (socket) => {
    // Handling socket connections.
    socket.on("message", (data) => {
      console.log(`Message arrived at ${process.pid}`);
    });
  });

  app.use(express.static("public"));
  // Handle HTTP Requests
  app.get("/", (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
  });
  io.on("connection", (socket) => {});

  io.on("connection", (socket) => {
    // Handling socket connections.
    socket.on("message", (data) => {
      console.log(`Message arrived at ${process.pid}:`, data);
      socket.emit("message", data);
    });
  });

  io.on("connection", (socket) => {
    // Handling socket connections.
    socket.on("message", (data) => {
      console.log(`Message arrived at ${process.pid}:`, data);
      io.broadcast.emit("message", data);
    });
  });


}
