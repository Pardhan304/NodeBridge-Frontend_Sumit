const express = require("express");
const cors = require("cors");
require("dotenv").config();

const verifyDeliveryRouter = require("./routes/verifyDelivery");
const configRouter = require("./routes/config");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api", verifyDeliveryRouter);
app.use("/api", configRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`NodeBridge backend listening on http://localhost:${PORT}`);
});
