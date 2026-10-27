const express = require("express");
const { loadContractConfig } = require("../contract");

const router = express.Router();

router.get("/config", (req, res) => {
  try {
    const { address, contract } = loadContractConfig();
    res.json({ address, abi: contract.interface.fragments.map((f) => f.format("json")).map(JSON.parse) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
