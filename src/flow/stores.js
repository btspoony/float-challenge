import { writable, get } from 'svelte/store';
import { TokenListProvider, Strategy, ENV } from "flow-native-token-registry";

export const user = writable(null);
export const getUser = get(user);
export const transactionStatus = writable(null);
export const txId = writable(null);
export const transactionInProgress = writable(false);

/**
____ _  _ ____ _  _ ___    ____ ____ ____ _ ____ ____ 
|___ |  | |___ |\ |  |     [__  |___ |__/ | |___ [__  
|___  \/  |___ | \|  |     ___] |___ |  \ | |___ ___] 
 */

/**
 * @param {string} key 
 */
 const buildWraitable = () => {
  return {
    "InProgress": writable(false),
    "Status": writable(false),
    "Key": writable(-1),
  }
}

/**
 * Event Series Reactive
 */
export const eventSeries = {
  Creation: buildWraitable(),
  Revoke: buildWraitable(),
  UpdateBasics: buildWraitable(),
  UpdateSlots: buildWraitable(),
  AddAchievementGoal: buildWraitable(),
  SyncCertificates: buildWraitable(),
  AddTreasuryStrategy: buildWraitable(),
  TreasuryManegement: buildWraitable(),
  NextTreasuryStrategyStage: buildWraitable(),
  AccompllishGoals: buildWraitable(),
  RefreshUserStatus: buildWraitable(),
  ClaimTreasuryRewards: buildWraitable(),
}

const tokenList = writable(null);
export const getLatestTokenList = async () => {
  /** @type {import('flow-native-token-registry').TokenInfo[]} */
  const cachedList = get(tokenList);
  if (!cachedList) {
    const tokens = await new TokenListProvider().resolve(Strategy.CDN, import.meta.env.VITE_FLOW_NETWORK ?? ENV.Mainnet);
    const list = tokens.getList()
    tokenList.set(list);
    return list;
  }
  return cachedList
}
/** @type {import('svelte/store').Writable<{[key: string]: import('../../lib/components/eventseries/types').CollectionInfo}>} */
export const cachedCollections = writable({});