const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EscrowMarketplace", function () {
  let escrow, owner, worker, seller, buyer, stranger;
  const voucherId = 1;
  const price = ethers.parseEther("1");
  const specHash = "0x8badf00d8badf00d8badf00d8badf00d8badf00d8badf00d8badf00d8badf00d";

  beforeEach(async function () {
    [owner, worker, seller, buyer, stranger] = await ethers.getSigners();

    const EscrowMarketplace = await ethers.getContractFactory("EscrowMarketplace");
    escrow = await EscrowMarketplace.deploy(owner.address);
    await escrow.waitForDeployment();

    await escrow.connect(owner).setWorkerAuthorization(worker.address, true);
  });

  it("allows a seller to list a voucher", async function () {
    await expect(escrow.connect(seller).listVoucher(voucherId, price, specHash))
      .to.emit(escrow, "VoucherListed")
      .withArgs(voucherId, seller.address, price, specHash);

    const v = await escrow.getVoucher(voucherId);
    expect(v.seller).to.equal(seller.address);
    expect(v.price).to.equal(price);
    expect(v.specHash).to.equal(specHash);
    expect(v.state).to.equal(0);
  });

  it("rejects a listing with an empty spec hash", async function () {
    await expect(
      escrow.connect(seller).listVoucher(voucherId, price, ethers.ZeroHash)
    ).to.be.revertedWith("Spec hash required");
  });

  it("prevents listing the same voucherId twice", async function () {
    await escrow.connect(seller).listVoucher(voucherId, price, specHash);
    await expect(
      escrow.connect(seller).listVoucher(voucherId, price, specHash)
    ).to.be.revertedWith("Voucher already exists");
  });

  it("allows a buyer to purchase and locks funds in escrow", async function () {
    await escrow.connect(seller).listVoucher(voucherId, price, specHash);

    await expect(
      escrow.connect(buyer).purchaseVoucher(voucherId, { value: price })
    )
      .to.emit(escrow, "VoucherPurchased")
      .withArgs(voucherId, buyer.address, price);

    const v = await escrow.getVoucher(voucherId);
    expect(v.buyer).to.equal(buyer.address);
    expect(v.state).to.equal(1);

    const contractBalance = await ethers.provider.getBalance(await escrow.getAddress());
    expect(contractBalance).to.equal(price);
  });

  it("rejects purchase with incorrect payment amount", async function () {
    await escrow.connect(seller).listVoucher(voucherId, price, specHash);
    await expect(
      escrow.connect(buyer).purchaseVoucher(voucherId, { value: ethers.parseEther("0.5") })
    ).to.be.revertedWith("Incorrect payment amount");
  });

  it("prevents the seller from buying their own voucher", async function () {
    await escrow.connect(seller).listVoucher(voucherId, price, specHash);
    await expect(
      escrow.connect(seller).purchaseVoucher(voucherId, { value: price })
    ).to.be.revertedWith("Seller cannot buy own voucher");
  });

  it("only allows owner or authorized worker to release funds", async function () {
    await escrow.connect(seller).listVoucher(voucherId, price, specHash);
    await escrow.connect(buyer).purchaseVoucher(voucherId, { value: price });

    await expect(
      escrow.connect(stranger).releaseFunds(voucherId)
    ).to.be.revertedWith("Not authorized");
  });

  it("releases funds to the seller when called by the authorized worker", async function () {
    await escrow.connect(seller).listVoucher(voucherId, price, specHash);
    await escrow.connect(buyer).purchaseVoucher(voucherId, { value: price });

    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

    await expect(escrow.connect(worker).releaseFunds(voucherId))
      .to.emit(escrow, "FundsReleased")
      .withArgs(voucherId, seller.address, price);

    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
    expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(price);

    const v = await escrow.getVoucher(voucherId);
    expect(v.state).to.equal(2);
  });

  it("prevents releasing funds twice", async function () {
    await escrow.connect(seller).listVoucher(voucherId, price, specHash);
    await escrow.connect(buyer).purchaseVoucher(voucherId, { value: price });
    await escrow.connect(worker).releaseFunds(voucherId);

    await expect(
      escrow.connect(worker).releaseFunds(voucherId)
    ).to.be.revertedWith("Not awaiting delivery");
  });

  it("allows the owner/worker to refund the buyer instead of releasing", async function () {
    await escrow.connect(seller).listVoucher(voucherId, price, specHash);
    await escrow.connect(buyer).purchaseVoucher(voucherId, { value: price });

    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

    await expect(escrow.connect(worker).refundBuyer(voucherId))
      .to.emit(escrow, "VoucherRefunded")
      .withArgs(voucherId, buyer.address, price);

    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
    expect(buyerBalanceAfter - buyerBalanceBefore).to.equal(price);
  });

  it("allows the seller to cancel an unpurchased listing", async function () {
    await escrow.connect(seller).listVoucher(voucherId, price, specHash);
    await escrow.connect(seller).cancelListing(voucherId);

    const v = await escrow.getVoucher(voucherId);
    expect(v.state).to.equal(3);

    await expect(
      escrow.connect(buyer).purchaseVoucher(voucherId, { value: price })
    ).to.be.revertedWith("Not available for purchase");
  });
});
