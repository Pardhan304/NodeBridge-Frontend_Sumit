// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// NodeBridge escrow for a compute job.
/// `seller` is the provider, `buyer` is the requester, and `specHash` is the
/// keccak256 of the canonical job spec (title, task, expected output).
contract EscrowMarketplace is ReentrancyGuard, Ownable {
    enum State {
        Listed,
        AwaitingDelivery,
        Delivered,
        Cancelled,
        Refunded
    }

    struct Voucher {
        address seller;
        address buyer;
        uint256 price;
        bytes32 specHash;
        State state;
        bool exists;
    }

    mapping(uint256 => Voucher) public vouchers;
    mapping(address => bool) public authorizedWorkers;

    event VoucherListed(uint256 indexed voucherId, address indexed seller, uint256 price, bytes32 specHash);
    event VoucherPurchased(uint256 indexed voucherId, address indexed buyer, uint256 amount);
    event FundsReleased(uint256 indexed voucherId, address indexed seller, uint256 amount);
    event VoucherRefunded(uint256 indexed voucherId, address indexed buyer, uint256 amount);
    event VoucherCancelled(uint256 indexed voucherId);
    event WorkerAuthorized(address indexed worker, bool authorized);

    modifier onlyOwnerOrWorker() {
        require(msg.sender == owner() || authorizedWorkers[msg.sender], "Not authorized");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setWorkerAuthorization(address worker, bool authorized) external onlyOwner {
        authorizedWorkers[worker] = authorized;
        emit WorkerAuthorized(worker, authorized);
    }

    function listVoucher(uint256 voucherId, uint256 price, bytes32 specHash) external {
        require(!vouchers[voucherId].exists, "Voucher already exists");
        require(price > 0, "Price must be > 0");
        require(specHash != bytes32(0), "Spec hash required");

        vouchers[voucherId] = Voucher({
            seller: msg.sender,
            buyer: address(0),
            price: price,
            specHash: specHash,
            state: State.Listed,
            exists: true
        });

        emit VoucherListed(voucherId, msg.sender, price, specHash);
    }

    function cancelListing(uint256 voucherId) external {
        Voucher storage v = vouchers[voucherId];
        require(v.exists, "Voucher does not exist");
        require(v.state == State.Listed, "Not listed");
        require(msg.sender == v.seller, "Not seller");

        v.state = State.Cancelled;
        emit VoucherCancelled(voucherId);
    }

    function purchaseVoucher(uint256 voucherId) external payable nonReentrant {
        Voucher storage v = vouchers[voucherId];
        require(v.exists, "Voucher does not exist");
        require(v.state == State.Listed, "Not available for purchase");
        require(msg.sender != v.seller, "Seller cannot buy own voucher");
        require(msg.value == v.price, "Incorrect payment amount");

        v.buyer = msg.sender;
        v.state = State.AwaitingDelivery;

        emit VoucherPurchased(voucherId, msg.sender, msg.value);
    }

    function releaseFunds(uint256 voucherId) external onlyOwnerOrWorker nonReentrant {
        Voucher storage v = vouchers[voucherId];
        require(v.exists, "Voucher does not exist");
        require(v.state == State.AwaitingDelivery, "Not awaiting delivery");

        v.state = State.Delivered;

        uint256 amount = v.price;
        address seller = v.seller;

        (bool success, ) = payable(seller).call{value: amount}("");
        require(success, "Transfer to seller failed");

        emit FundsReleased(voucherId, seller, amount);
    }

    function refundBuyer(uint256 voucherId) external onlyOwnerOrWorker nonReentrant {
        Voucher storage v = vouchers[voucherId];
        require(v.exists, "Voucher does not exist");
        require(v.state == State.AwaitingDelivery, "Not awaiting delivery");

        v.state = State.Refunded;

        uint256 amount = v.price;
        address buyer = v.buyer;

        (bool success, ) = payable(buyer).call{value: amount}("");
        require(success, "Refund to buyer failed");

        emit VoucherRefunded(voucherId, buyer, amount);
    }

    function getVoucher(uint256 voucherId) external view returns (Voucher memory) {
        require(vouchers[voucherId].exists, "Voucher does not exist");
        return vouchers[voucherId];
    }
}
