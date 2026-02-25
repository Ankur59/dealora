const express = require("express")
const { handleConnect, handleAllEmails } = require("../controllers/connectEmailController")

const router = express.Router()

router.post("/link-gmail", handleConnect)
router.get("/linked-emails", handleAllEmails)

module.exports = router