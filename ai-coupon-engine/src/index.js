import dotenv from "dotenv";
import connectDB from "./db/connectDB.js";
import app from "./app.js";
import { fetchAndNormalizePartnerData } from "./services/normalization.service.js";

dotenv.config();

const PORT = process.env.PORT || 8000;

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running at port : ${PORT}`);
            fetchAndNormalizePartnerData("vcommission", "campaigns")
        });
    })
    .catch((err) => {
        console.log("MONGO db connection failed !!! ", err);
    });