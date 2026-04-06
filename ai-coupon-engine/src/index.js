import app from "./app.js"
import { connectDB } from "./db/connectDB.js"
import { getAllCampaigns } from "./providers/trackier.js";
import { syncCampaignVCom } from "./services/vcommission/campaign.service.js";

import { syncCategories } from "./services/vcommission/category.service.js";

connectDB(process.env.MONGODB_URI)
    .then(
        app.listen(process.env.PORT || 8000, () => { console.log("Server started at port: ", process.env.PORT || 8000) }),
     
    )
    .catch((err) => {
        console.log("MONGO db connection failed !!! ", err);
    });