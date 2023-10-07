import { get } from "svelte/store";
import { resolver } from "$lib/stores.js";

export function parseErrorMessageFromFCL(errorString) {
  if (errorString.includes("bytes of storage which is over its capacity")) {
    const address = errorString.substring(
      errorString.indexOf("(") + 1,
      errorString.indexOf("(") + 17
    );
    return (
      "The account with address " +
      address +
      " needs more FLOW token in their account (.1 FLOW will be enough)."
    );
  }
  if (errorString.includes("HTTP Request Error")) {
    return "Flow Mainnet is currently undergoing maintenance. You can try to refresh the page or try again later.";
  }
  if (errorString.includes("sequence number")) {
    return "Please refresh the page and try again.";
  }
  let newString = errorString.replace(
    "[Error Code: 1101] cadence runtime error Execution failed:\nerror: assertion failed:",
    "Error:"
  );
  newString = newString.replace(
    "[Error Code: 1101] cadence runtime error Execution failed:\nerror: panic:",
    "Error:"
  );
  newString = newString.replace(
    "[Error Code: 1101] cadence runtime error Execution failed:\nerror: pre-condition failed:",
    "Error:"
  );
  newString = newString.replace(
    "[Error Code: 1101] cadence runtime error Execution failed:\nerror: ",
    "Error:"
  );
  newString = newString.replace(/-->.*/, "");
  return newString;
}

export function getResolvedName(addressObject, priority = get(resolver)) {
  if (addressObject.resolvedNames[priority]) {
    return addressObject.resolvedNames[priority];
  }
  if (addressObject.resolvedNames["fn"]) {
    return addressObject.resolvedNames["fn"];
  }
  if (addressObject.resolvedNames["find"]) {
    return addressObject.resolvedNames["find"];
  }
  return addressObject.address;
}

export const formatter = new Intl.DateTimeFormat("en-US");

/**
 * Parse an Image URL
 * @param {string} url
 */
export function parseIPFSImageURL(url) {
  const urlCheck = url.toLowerCase();
  if (urlCheck.startsWith("http") || urlCheck.startsWith("data:image")) {
    return url;
  } else {
    return `https://nftstorage.link/ipfs/${url}`;
  }
}

export function getFLOATEventUrl(hostAddress, id) {
  return `https://floats.city/event/${hostAddress}/${id}`;
}
