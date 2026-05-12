import express from "express";
import {
    createPartner,
    getPartners,
    getPartnerById,
    upsertPartnerApi,
    updateApiDiff,
    deletePartner,
    syncPartnerData
} from "../controllers/partner.controller.js";

const router = express.Router();

// Partner CRUD Routes
router.post("/", createPartner);
router.get("/", getPartners);
router.get("/:id", getPartnerById);
router.delete("/:id", deletePartner);

// Partner API Routes
router.post("/:id/apis", upsertPartnerApi);
router.put("/:partnerId/apis/:apiId/diff", updateApiDiff);

// Sync/Normalize Route
router.post("/sync/:partnerName/:targetSchema", syncPartnerData);

export default router;
