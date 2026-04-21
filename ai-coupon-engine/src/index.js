import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import { connectDB } from "./db/connectDB.js";

const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: (process.env.CORS_ORIGIN || "http://localhost:5173"),
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("Dashboard connected:", socket.id);
});

connectDB(process.env.MONGODB_URI)
  .then(() => {
    server.listen(process.env.PORT || 8000, () => {
      console.log("Server started at port: ", process.env.PORT || 8000);
    });
  })
  .catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
  });
