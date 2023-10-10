import { config } from "@onflow/fcl";

export const network = import.meta.env.VITE_FLOW_NETWORK;

const dappInfo = {
  title: "FLOAT",
  description: "A proof of attendance platform on the Flow blockchain.",
  url: "https://floats.city",
  author: "Emerald City DAO",
  icon: "https://i.imgur.com/v0Njnnk.png",
};

const fclConfigInfo = {
  emulator: {
    accessNode: "http://127.0.0.1:8888",
    discoveryWallet: "http://localhost:8701/fcl/authn",
    discoveryAuthInclude: [],
  },
  testnet: {
    accessNode: "https://rest-testnet.onflow.org",
    discoveryWallet: "https://fcl-discovery.onflow.org/testnet/authn",
    discoveryAuthInclude: ["0x82ec283f88a62e65", "0x9d2e44203cb13051"],
  },
  mainnet: {
    accessNode: "https://rest-mainnet.onflow.org",
    discoveryWallet: "https://fcl-discovery.onflow.org/authn",
    discoveryAuthInclude: ["0xead892083b3e2c6c", "0xe5cd26afebe62781"],
  },
};

config({
  "app.detail.title": dappInfo.title,
  "app.detail.icon": dappInfo.icon,
  "app.detail.id": import.meta.env.PUBLIC_BLOCTO_DAPP_ID, // for blocto v2
  "flow.network": network,
  "accessNode.api": fclConfigInfo[network].accessNode,
  "discovery.wallet": fclConfigInfo[network].discoveryWallet,
  // include Dapper Wallet and Ledger.
  // Docs: https://developers.flow.com/tools/clients/fcl-js/api#more-configuration
  // "discovery.authn.include": fclConfigInfo[network].discoveryAuthInclude,
  "0xFN": "0x233eb012d34b0070",
  "0xFIND": "0x097bafa4e0b48eef",
});

const floatEventSeriesAddress =
  import.meta.env.VITE_FLOAT_EVENTSERIES_ADDRESS ||
  (network === "testnet" ? "0x78ba14dd1c817ec7" : "0x1dd5caae66e2c440");

export const addressMap = {
  FlowToken:
    network === "testnet" ? "0x7e60df042a9c0868" : "0x1654653399040a61",
  FungibleToken:
    network === "testnet" ? "0x9a0766d93b6608b7" : "0xf233dcee88fe0abe",
  NonFungibleToken:
    network === "testnet" ? "0x631e88ae7f1d7c20" : "0x1d7e57aa55817448",
  MetadataViews:
    network === "testnet" ? "0x631e88ae7f1d7c20" : "0x1d7e57aa55817448",
  FLOAT: network === "testnet" ? "0x0afe396ebc8eee65" : "0x2d4c3caffbeab845",
  FLOATVerifiers:
    network === "testnet" ? "0x0afe396ebc8eee65" : "0x2d4c3caffbeab845",
  NFTCatalog:
    network === "testnet" ? "0x324c34e1c517e4db" : "0x49a7cda3a1eecc29",
  NFTRetrieval:
    network === "testnet" ? "0x324c34e1c517e4db" : "0x49a7cda3a1eecc29",
  // FLOAT Challenge Addresses
  FLOATEventSeries: floatEventSeriesAddress,
  FLOATEventSeriesViews: floatEventSeriesAddress,
  FLOATEventSeriesGoals: floatEventSeriesAddress,
  FLOATTreasuryStrategies: floatEventSeriesAddress,
};

export const verifiersIdentifier =
  "A." + addressMap.FLOATVerifiers.substring(2);