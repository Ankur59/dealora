const express = require("express")
const { handleConnect, handleAllEmails, handleRemoveEmail } = require("../controllers/connectEmailController")

const router = express.Router()

router.post("/link-gmail", handleConnect)
router.get("/linked-emails", handleAllEmails)
router.post("/remove-email", handleRemoveEmail)

module.exports = router