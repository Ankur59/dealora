import app from "./app.js"
import { connectDB } from "./db/connectDB.js"
import coupon from "./models/coupon.model.js";
import { syncCategories } from "./services/coupomated/category.service.js";
import { syncAllCoupons } from "./services/coupomated/coupon.service.js";


connectDB(process.env.MONGODB_URI)
    .then(
        app.listen(process.env.PORT || 8000, () => { console.log("Server started at port: ", process.env.PORT || 8000) }),
    )
    .catch((err) => {
        console.log("MONGO db connection failed !!! ", err);
    });