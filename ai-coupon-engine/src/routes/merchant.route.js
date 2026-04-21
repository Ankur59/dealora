import express from "express";
import {
  activateMerchant,
  createMerchant,
  deactivateMerchant,
  getMerchantById,
  getMerchants,
  updateMerchant,
} from "../controllers/merchant.controller.js";

const router = express.Router();

router.post("/", createMerchant);
router.get("/", getMerchants);
router.get("/:id", getMerchantById);
router.put("/:id", updateMerchant);
router.put("/:id/activate", activateMerchant);
router.put("/:id/deactivate", deactivateMerchant);
router.delete("/:id", deactivateMerchant);

export default router;
