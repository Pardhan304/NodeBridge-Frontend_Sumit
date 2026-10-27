export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

export const ESCROW_ABI = [
  {
    type: "function",
    name: "listVoucher",
    inputs: [
      { name: "voucherId", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "specHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "purchaseVoucher",
    inputs: [{ name: "voucherId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "cancelListing",
    inputs: [{ name: "voucherId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "releaseFunds",
    inputs: [{ name: "voucherId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getVoucher",
    inputs: [{ name: "voucherId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "buyer", type: "address" },
          { name: "price", type: "uint256" },
          { name: "specHash", type: "bytes32" },
          { name: "state", type: "uint8" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "VoucherListed",
    inputs: [
      { name: "voucherId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "specHash", type: "bytes32", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "VoucherPurchased",
    inputs: [
      { name: "voucherId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "FundsReleased",
    inputs: [
      { name: "voucherId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
];

export const VOUCHER_STATE = {
  0: "Listed",
  1: "AwaitingDelivery",
  2: "Delivered",
  3: "Cancelled",
  4: "Refunded",
};
