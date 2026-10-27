const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const EscrowMarketplace = await hre.ethers.getContractFactory("EscrowMarketplace");
  const escrow = await EscrowMarketplace.deploy(deployer.address);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log("EscrowMarketplace deployed to:", address);

  const workerAddress = process.env.BACKEND_WORKER_ADDRESS || deployer.address;
  if (workerAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    const tx = await escrow.setWorkerAuthorization(workerAddress, true);
    await tx.wait();
    console.log("Authorized backend worker:", workerAddress);
  }

  const artifact = await hre.artifacts.readArtifact("EscrowMarketplace");
  const deploymentInfo = {
    address,
    abi: artifact.abi,
    network: hre.network.name,
    deployer: deployer.address,
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${hre.network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment info written to deployments/${hre.network.name}.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
