const hre = require("hardhat");

async function main() {
  const workerAddress = process.env.WORKER_ADDRESS;
  if (!workerAddress) {
    throw new Error("Set WORKER_ADDRESS env var to the backend worker address to authorize");
  }

  const [owner] = await hre.ethers.getSigners();
  const deployment = require(`../deployments/${hre.network.name}.json`);
  const escrow = await hre.ethers.getContractAt(
    "EscrowMarketplace",
    deployment.address,
    owner
  );

  const already = await escrow.authorizedWorkers(workerAddress);
  console.log("Already authorized?", already);

  if (!already) {
    const tx = await escrow.setWorkerAuthorization(workerAddress, true);
    await tx.wait();
    console.log("Authorized", workerAddress);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
