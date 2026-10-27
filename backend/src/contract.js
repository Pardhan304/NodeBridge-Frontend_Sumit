const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
require("dotenv").config();

function loadContractConfig() {
  const { RPC_URL, BACKEND_PRIVATE_KEY, CONTRACT_ADDRESS } = process.env;

  if (!BACKEND_PRIVATE_KEY) {
    throw new Error("BACKEND_PRIVATE_KEY is not set in backend/.env");
  }

  let address = CONTRACT_ADDRESS;
  let abi;

  const deploymentPath = path.join(
    __dirname,
    "..",
    "..",
    "contracts",
    "deployments",
    "localhost.json"
  );

  if (fs.existsSync(deploymentPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
    abi = deployment.abi;
    if (!address) address = deployment.address;
  } else {
    abi = require("./abi/EscrowMarketplace.json");
  }

  if (!address) {
    throw new Error(
      "CONTRACT_ADDRESS is not set and no deployment artifact was found. " +
        "Deploy the contract first or set CONTRACT_ADDRESS in backend/.env"
    );
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL || "http://127.0.0.1:8545");
  const wallet = new ethers.Wallet(BACKEND_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(address, abi, wallet);

  return { provider, wallet, contract, address };
}

module.exports = { loadContractConfig };
