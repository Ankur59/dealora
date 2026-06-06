import http from "http";
import app from "./app.js";
import { connectDB } from "./db/connectDB.js";
import { io } from "./socket.js";
import verificationSchedulerService from './services/verificationScheduler.service.js';
import partnerSyncSchedulerService from './services/partnerSyncScheduler.service.js';
import { fetchAndNormalizePartnerData } from "./services/normalization.service.js";

const server = http.createServer(app);
io.attach(server);

io.on("connection", (socket) => {
  console.log("Dashboard connected:", socket.id);
});

connectDB(process.env.MONGODB_URI)
  .then(() => {
    // Initialize verification scheduler
    verificationSchedulerService.init();

    // Initialize partner sync scheduler
    partnerSyncSchedulerService.init();

    server.listen(process.env.PORT || 8000, () => {
      console.log("Server started at port: ", process.env.PORT || 8000);
    })
  })
  .catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
  });
