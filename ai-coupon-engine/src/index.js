import app from "./app.js"
import { connectDB } from "./db/connectDB.js"
import { fetchAndNormalizePartnerData } from "./services/normalization.service.js";


connectDB(process.env.MONGODB_URI)
    .then(
        app.listen(process.env.PORT || 8000, () => { console.log("Server started at port: ", process.env.PORT || 8000) }),
        // fetchAndNormalizePartnerData("vcommission", "coupons"))
    .catch((err) => {
        console.log("MONGO db connection failed !!! ", err);
    });