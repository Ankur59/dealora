import app from "./app.js"
import { connectDB } from "./db/connectDB.js"
import { fetchAndNormalizePartnerData } from "./services/normalization.service.js";
import { runValidation } from "./services/validator.service.js";
import cron from "node-cron";


connectDB(process.env.MONGODB_URI)
    .then(() => {
        app.listen(process.env.PORT || 8000, () => { console.log("Server started at port: ", process.env.PORT || 8000) });
        
        cron.schedule('0 */12 * * *', () => {
            console.log("Cron: starting validation run...");
            runValidation().catch(err => console.error("Validation failed:", err));
        });
    })
    .catch((err) => {
        console.log("MONGO db connection failed !!! ", err);
    });