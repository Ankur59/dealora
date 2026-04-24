import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import { connectDB } from "./db/connectDB.js";
import verificationSchedulerService from './services/verificationScheduler.service.js';

const server = http.createServer(app);
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("Dashboard connected:", socket.id);
});

connectDB(process.env.MONGODB_URI)
  .then(() => {
    // Initialize verification scheduler
    verificationSchedulerService.init();

    server.listen(process.env.PORT || 8000, () => {
      console.log("Server started at port: ", process.env.PORT || 8000);
    });
  })
  .catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
  });
