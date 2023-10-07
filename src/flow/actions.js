import { browser } from '$app/env';

import * as fcl from "@onflow/fcl";

import "./config.js";
import { addressMap, flowTokenIdentifier } from './config.js';
import {
  user,
  txId,
  transactionStatus,
  transactionInProgress,
  eventSeries,
  cachedCollections,
} from "./stores.js";
import { get } from "svelte/store";

import * as cadence from "./cadence";

import { draftFloat } from "$lib/stores";
import { respondWithError, respondWithSuccess } from "$lib/response";
import { parseErrorMessageFromFCL } from "./utils.js";
import { notifications } from "$lib/notifications";

if (browser) {
  // set Svelte $user store to currentUser,
  // so other components can access it
  fcl.currentUser.subscribe(user.set, []);
}

// Lifecycle FCL Auth functions
export const unauthenticate = () => fcl.unauthenticate();
export const authenticate = async () => {
  await fcl.authenticate();
};

/****************************** SETTERS ******************************/

export const setupAccount = async () => {
  setupAccountInProgress.set(true);

  let transactionId = false;
  initTransactionState();

  try {
    transactionId = await fcl.mutate({
      cadence: `
      import FLOAT from 0xFLOAT
      import NonFungibleToken from 0xCORE
      import MetadataViews from 0xCORE
      import GrantedAccountAccess from 0xFLOAT

      transaction {

        prepare(acct: AuthAccount) {
          // SETUP COLLECTION
          if acct.borrow<&FLOAT.Collection>(from: FLOAT.FLOATCollectionStoragePath) == nil {
              acct.save(<- FLOAT.createEmptyCollection(), to: FLOAT.FLOATCollectionStoragePath)
              acct.link<&FLOAT.Collection{NonFungibleToken.Receiver, NonFungibleToken.CollectionPublic, MetadataViews.ResolverCollection, FLOAT.CollectionPublic}>
                      (FLOAT.FLOATCollectionPublicPath, target: FLOAT.FLOATCollectionStoragePath)
          }

          // SETUP FLOATEVENTS
          if acct.borrow<&FLOAT.FLOATEvents>(from: FLOAT.FLOATEventsStoragePath) == nil {
            acct.save(<- FLOAT.createEmptyFLOATEventCollection(), to: FLOAT.FLOATEventsStoragePath)
            acct.link<&FLOAT.FLOATEvents{FLOAT.FLOATEventsPublic, MetadataViews.ResolverCollection}>
                      (FLOAT.FLOATEventsPublicPath, target: FLOAT.FLOATEventsStoragePath)
          }

          // SETUP SHARED MINTING
          if acct.borrow<&GrantedAccountAccess.Info>(from: GrantedAccountAccess.InfoStoragePath) == nil {
              acct.save(<- GrantedAccountAccess.createInfo(), to: GrantedAccountAccess.InfoStoragePath)
              acct.link<&GrantedAccountAccess.Info{GrantedAccountAccess.InfoPublic}>
                      (GrantedAccountAccess.InfoPublicPath, target: GrantedAccountAccess.InfoStoragePath)
          }
        }

        execute {
          log("Finished setting up the account for FLOATs.")
        }
      }
      `,
      args: (arg, t) => [],
      payer: fcl.authz,
      proposer: fcl.authz,
      authorizations: [fcl.authz],
      limit: 999,
    });

    txId.set(transactionId);

    fcl.tx(transactionId).subscribe((res) => {
      transactionStatus.set(res.status);
      if (res.status === 4) {
        if (res.statusCode === 0) {
          setupAccountStatus.set(respondWithSuccess());
        } else {
          setupAccountStatus.set(
            respondWithError(
              parseErrorMessageFromFCL(res.errorMessage),
              res.statusCode
            )
          );
        }
        setupAccountInProgress.set(false);
        setTimeout(() => transactionInProgress.set(false), 2000);
      }
    });

    let res = await fcl.tx(transactionId).onceSealed();
    return res;
  } catch (e) {
    setupAccountStatus.set(false);
    transactionStatus.set(99);
    console.log(e);

    setTimeout(() => transactionInProgress.set(false), 10000);
  }
};

/****************************** GETTERS ******************************/

export const isSetup = async (addr) => {
  try {
    let queryResult = await fcl.query({
      cadence: `
      import FLOAT from 0xFLOAT
      import NonFungibleToken from 0xCORE
      import MetadataViews from 0xCORE
      import GrantedAccountAccess from 0xFLOAT

      pub fun main(accountAddr: Address): Bool {
        let acct = getAccount(accountAddr)

        if acct.getCapability<&FLOAT.Collection{FLOAT.CollectionPublic}>(FLOAT.FLOATCollectionPublicPath).borrow() == nil {
            return false
        }
      
        if acct.getCapability<&FLOAT.FLOATEvents{FLOAT.FLOATEventsPublic}>(FLOAT.FLOATEventsPublicPath).borrow() == nil {
          return false
        }
      
        if acct.getCapability<&GrantedAccountAccess.Info{GrantedAccountAccess.InfoPublic}>(GrantedAccountAccess.InfoPublicPath).borrow() == nil {
            return false
        }

        return true
      }
      `,
      args: (arg, t) => [arg(addr, t.Address)],
    });
    return queryResult;
  } catch (e) {
    console.log(e);
  }
};

export const getEvent = async (addr, eventId) => {
  try {
    let queryResult = await fcl.query({
      cadence: `
      import FLOAT from 0xFLOAT

      pub fun main(account: Address, eventId: UInt64): FLOATEventMetadata {
        let floatEventCollection = getAccount(account).getCapability(FLOAT.FLOATEventsPublicPath)
                                    .borrow<&FLOAT.FLOATEvents{FLOAT.FLOATEventsPublic}>()
                                    ?? panic("Could not borrow the FLOAT Events Collection from the account.")
        let event = floatEventCollection.borrowPublicEventRef(eventId: eventId) ?? panic("This event does not exist in the account")
        return FLOATEventMetadata(
          _claimable: event.claimable, 
          _dateCreated: event.dateCreated, 
          _description: event.description, 
          _eventId: event.eventId, 
          _extraMetadata: event.getExtraMetadata(), 
          _groups: event.getGroups(), 
          _host: event.host, 
          _image: event.image, 
          _name: event.name, 
          _totalSupply: event.totalSupply, 
          _transferrable: event.transferrable, 
          _url: event.url, 
          _verifiers: event.getVerifiers()
        )
      }

      pub struct FLOATEventMetadata {
        pub let claimable: Bool
        pub let dateCreated: UFix64
        pub let description: String 
        pub let eventId: UInt64
        pub let extraMetadata: {String: AnyStruct}
        pub let groups: [String]
        pub let host: Address
        pub let image: String 
        pub let name: String
        pub let totalSupply: UInt64
        pub let transferrable: Bool
        pub let url: String
        pub let verifiers: {String: [{FLOAT.IVerifier}]}

        init(
            _claimable: Bool,
            _dateCreated: UFix64,
            _description: String, 
            _eventId: UInt64,
            _extraMetadata: {String: AnyStruct},
            _groups: [String],
            _host: Address, 
            _image: String, 
            _name: String,
            _totalSupply: UInt64,
            _transferrable: Bool,
            _url: String,
            _verifiers: {String: [{FLOAT.IVerifier}]}
        ) {
            self.claimable = _claimable
            self.dateCreated = _dateCreated
            self.description = _description
            self.eventId = _eventId
            self.extraMetadata = _extraMetadata
            self.groups = _groups
            self.host = _host
            self.image = _image
            self.name = _name
            self.transferrable = _transferrable
            self.totalSupply = _totalSupply
            self.url = _url
            self.verifiers = _verifiers
        }
      }
      `,
      args: (arg, t) => [arg(addr, t.Address), arg(eventId, t.UInt64)],
    });
    return queryResult || {};
  } catch (e) {
    console.log(e);
  }
};

export const getEvents = async (addr) => {
  try {
    let queryResult = await fcl.query({
      cadence: `
      import FLOAT from 0xFLOAT

      pub fun main(account: Address): {UFix64: FLOATEventMetadata} {
        let floatEventCollection = getAccount(account).getCapability(FLOAT.FLOATEventsPublicPath)
                                    .borrow<&FLOAT.FLOATEvents{FLOAT.FLOATEventsPublic}>()
                                    ?? panic("Could not borrow the FLOAT Events Collection from the account.")
        let floatEvents: [UInt64] = floatEventCollection.getIDs() 
        let returnVal: {UFix64: FLOATEventMetadata} = {}

        for eventId in floatEvents {
          let event = floatEventCollection.borrowPublicEventRef(eventId: eventId) ?? panic("This event does not exist in the account")
          let metadata = FLOATEventMetadata(
            _claimable: event.claimable, 
            _dateCreated: event.dateCreated, 
            _description: event.description, 
            _eventId: event.eventId, 
            _extraMetadata: event.getExtraMetadata(), 
            _groups: event.getGroups(), 
            _host: event.host, 
            _image: event.image, 
            _name: event.name, 
            _totalSupply: event.totalSupply, 
            _transferrable: event.transferrable, 
            _url: event.url, 
            _verifiers: event.getVerifiers()
          )
          returnVal[event.dateCreated] = metadata
        }
        return returnVal
      }

      pub struct FLOATEventMetadata {
        pub let claimable: Bool
        pub let dateCreated: UFix64
        pub let description: String 
        pub let eventId: UInt64
        pub let extraMetadata: {String: AnyStruct}
        pub let groups: [String]
        pub let host: Address
        pub let image: String 
        pub let name: String
        pub let totalSupply: UInt64
        pub let transferrable: Bool
        pub let url: String
        pub let verifiers: {String: [{FLOAT.IVerifier}]}

        init(
            _claimable: Bool,
            _dateCreated: UFix64,
            _description: String, 
            _eventId: UInt64,
            _extraMetadata: {String: AnyStruct},
            _groups: [String],
            _host: Address, 
            _image: String, 
            _name: String,
            _totalSupply: UInt64,
            _transferrable: Bool,
            _url: String,
            _verifiers: {String: [{FLOAT.IVerifier}]}
        ) {
            self.claimable = _claimable
            self.dateCreated = _dateCreated
            self.description = _description
            self.eventId = _eventId
            self.extraMetadata = _extraMetadata
            self.groups = _groups
            self.host = _host
            self.image = _image
            self.name = _name
            self.transferrable = _transferrable
            self.totalSupply = _totalSupply
            self.url = _url
            self.verifiers = _verifiers
        }
      }
      `,
      args: (arg, t) => [arg(addr, t.Address)],
    });
    return queryResult || {};
  } catch (e) {}
};

export const resolveAddressObject = async (lookup) => {
  let answer = {
    resolvedNames: {
      find: "",
      fn: ""
    },
    address: ""
  };
  let rootLookup = lookup.split('.')[0];
  // const findCache = JSON.parse(localStorage.getItem('findCache')) || {};
  // if (findCache && findCache[lookup]) {
  //   return Promise.resolve(findCache[lookup]);
  // }
  try {
    if (rootLookup.length === 18 && rootLookup.substring(0, 2) === '0x') {
      answer.address = lookup;
      // FIXME: no need resolve names in dev
      if (import.meta.env.DEV && import.meta.env.VITE_FLOW_NETWORK === 'testnet') {
        return answer
      }
      answer.resolvedNames.find = await fcl.query({
        cadence: `
        import FIND from 0xFIND

        pub fun main(address: Address): String? {
            let name = FIND.reverseLookup(address)
            return name?.concat(".find")
        }
        `,
        args: (arg, t) => [
          arg(lookup, t.Address)
        ]
      });

      answer.resolvedNames.fn = await fcl.query({
        cadence: `
        import Domains from 0xFN
      
        pub fun main(address: Address): String? {
    
          let account = getAccount(address)
          let collectionCap = account.getCapability<&{Domains.CollectionPublic}>(Domains.CollectionPublicPath) 
      
          if collectionCap.check() != true {
            return nil
          }
      
          var flownsName = ""
          let collection = collectionCap.borrow()!
          let ids = collection.getIDs()
          
          for id in ids {
            let domain = collection.borrowDomain(id: id)!
            let isDefault = domain.getText(key: "isDefault")
            flownsName = domain.getDomainName()
            if isDefault == "true" {
              break
            }
          }
      
          return flownsName
        }
        `,
        args: (arg, t) => [
          arg(lookup, t.Address)
        ]
      });
    } else if (lookup.includes('.find')) {
      answer.resolvedNames.find = lookup;
      answer.address = await fcl.query({
        cadence: `
        import FIND from 0xFIND
  
        pub fun main(name: String) : Address?  {
          return FIND.lookupAddress(name)
        }
        `,
        args: (arg, t) => [
          arg(rootLookup, t.String)
        ]
      })
    } else if (lookup.includes('.fn') || lookup.includes('.meow')) {
      let nameArr = lookup.split('.')
      const label = nameArr[0]
      const parent = nameArr[1]
      answer.resolvedNames.fn = lookup
      answer.address = await fcl.query({
        cadence: `
        import Flowns from 0xFN
        import Domains from 0xFN
        pub fun main(label: String, parent: String): Address? {
          
          let prefix = "0x"
          let rootHash = Flowns.hash(node: "", lable: parent)
          let nameHash = prefix.concat(Flowns.hash(node: rootHash, lable: label))
          let address = Domains.getRecords(nameHash)
        
          return address
        }
        `,
        args: (arg, t) => [
          arg(label, t.String),
          arg(parent, t.String)
        ]
      })
    }
    // findCache[lookup] = queryResult;
    // localStorage.setItem('findCache', JSON.stringify(findCache));
    return answer;
  } catch (e) {
    return answer;
  }
}

function initTransactionState() {
  // configureFCL(get(currentWallet));
  // console.log(get(currentWallet));
  transactionInProgress.set(true);
  transactionStatus.set(-1);
  floatClaimedStatus.set(false);
  eventCreatedStatus.set(false);
}

/**
 * genrenal method of sending transaction
 * 
 * @param {string} code
 * @param {fcl.ArgsFn} args
 * @param {import('svelte/store').Writable<boolean>} inProgress 
 * @param {import('svelte/store').Writable<boolean>} actionStatus 
 * @param {(string, string)=>void} [onSealed=undefined]
 * @param {number} [gasLimit=9999]
 */
const generalSendTransaction = async (code, args, actionInProgress = undefined, actionStatus = undefined, gasLimit = 9999, onSealed = undefined) => {
  gasLimit = gasLimit || 9999

  actionInProgress && actionInProgress.set(true);

  let transactionId = false;
  initTransactionState();

  try {
    transactionId = await fcl.mutate({
      cadence: code,
      args: args,
      payer: fcl.authz,
      proposer: fcl.authz,
      authorizations: [fcl.authz],
      limit: gasLimit
    })

    txId.set(transactionId);

    return new Promise((resolve, reject) => {
      fcl.tx(transactionId).subscribe(res => {
        transactionStatus.set(res.status)

        if (res.status === 4) {
          if (res.statusCode === 0) {
            actionStatus && actionStatus.set(respondWithSuccess());
          } else {
            actionStatus && actionStatus.set(respondWithError(parseErrorMessageFromFCL(res.errorMessage), res.statusCode))
          }
          actionInProgress && actionInProgress.set(false);

          // on sealed callback
          if (typeof onSealed === 'function') {
            onSealed(transactionId, res.statusCode === 0 ? undefined : res.errorMessage)
          }

          setTimeout(() => transactionInProgress.set(false), 2000)

          resolve();
        }
      })
    })
  } catch (e) {
    actionInProgress && actionInProgress.set(false);
    actionStatus && actionStatus.set(respondWithError(e));
    transactionStatus.set(99)
    console.log(e)

    setTimeout(() => transactionInProgress.set(false), 10000)
  }
}

/**
 * genrenal method of query transaction
 * 
 * @param {string} code
 * @param {fcl.ArgsFn} args
 * @param {any} defaultValue
 */
const generalQuery = async (code, args, defaultValue = {}) => {
  try {
    const queryResult = await fcl.query({ cadence: code, args })
    return queryResult ?? defaultValue
  } catch (e) {
    console.error(e)
  }
}

/**
____ _  _ ____ _  _ ___    ____ ____ ____ _ ____ ____ 
|___ |  | |___ |\ |  |     [__  |___ |__/ | |___ [__  
|___  \/  |___ | \|  |     ___] |___ |  \ | |___ ___] 
 */

// -------------- Setter - Transactions --------------

// **************************
// ** Event Series Builder **
// **************************

/**
 * create a new event series
 * 
 * @param {object} basics basic information
 * @param {string} basics.name
 * @param {string} basics.description
 * @param {string} basics.image
 * @param {object[]} presetEvents
 * @param {object} presetEvents.event
 * @param {string} presetEvents.event.host
 * @param {number} presetEvents.event.id
 * @param {boolean} presetEvents.required
 * @param {number} emptySlotsAmt how many empty slots totally
 * @param {number} emptySlotsAmtRequired how many empty slots is required
 */
export const createEventSeries = async (basics, presetEvents, emptySlotsAmt = 0, emptySlotsAmtRequired = 0) => {
  const reduced = presetEvents.reduce((all, curr) => {
    if (typeof curr.event?.host === 'string' &&
      typeof curr.event?.id === 'string' &&
      (typeof curr.required === 'boolean' || curr.required === undefined)) {
      all.hosts.push(curr.event.host)
      all.eventIds.push(curr.event.id ?? curr.event.eventId)
      all.required.push(curr.required ?? true)
    }
    return all
  }, { hosts: [], eventIds: [], required: [] })

  return await generalSendTransaction(
    cadence.replaceImportAddresses(cadence.txCreateEventSeries, addressMap),
    (arg, t) => [
      arg(basics.name, t.String),
      arg(basics.description, t.String),
      arg(basics.image, t.String),
      arg(String(emptySlotsAmt), t.UInt64),
      arg(emptySlotsAmtRequired ? String(emptySlotsAmtRequired) : '0', t.UInt64),
      arg(reduced.hosts, t.Array(t.Address)),
      arg(reduced.eventIds, t.Array(t.UInt64)),
      arg(reduced.required, t.Array(t.Bool))
    ],
    eventSeries.Creation.InProgress,
    eventSeries.Creation.Status
  )
}

/**
 * add a goal to EventSeries
 * 
 * @param {import('../components/eventseries/types').AddAchievementGoalRequest}
 */
export const addAchievementGoalToEventSeries = async ({ type, seriesId, points, params, title }) => {
  let code
  /** @type {fcl.ArgsFn} */
  let args
  switch (type) {
    case 'byAmount':
      code = cadence.replaceImportAddresses(cadence.txAddEventSeriesGoalByAmount, addressMap)

      const { eventsAmount, requiredEventsAmount } = params || {}
      if (eventsAmount === undefined) {
        throw new Error('eventsAmount is missing')
      }
      args = (arg, t) => [
        arg(seriesId, t.UInt64),
        arg(String(points), t.UInt64),
        arg(String(eventsAmount), t.UInt64),
        arg(String(requiredEventsAmount), t.UInt64),
        arg(title || null, t.Optional(t.String)),
      ]
      break;

    case 'byPercent':
      code = cadence.replaceImportAddresses(cadence.txAddEventSeriesGoalByPercent, addressMap)

      const { percent } = params || {}
      if (percent === undefined) {
        throw new Error('percent is missing')
      }
      args = (arg, t) => [
        arg(seriesId, t.UInt64),
        arg(String(points), t.UInt64),
        arg((percent / 100.0).toFixed(1), t.UFix64),
        arg(title || null, t.Optional(t.String)),
      ]
      break;

    case 'bySpecifics':
      code = cadence.replaceImportAddresses(cadence.txAddEventSeriesGoalBySpecifics, addressMap)

      const { events } = params || {}
      if (events === undefined && !Array.isArray(events)) {
        throw new Error('events is missing')
      }
      const reduced = events.reduce((all, curr) => {
        if (typeof curr.host === 'string' && typeof curr.id === 'string') {
          all.hosts.push(curr.host)
          all.eventIds.push(curr.id)
        }
        return all
      }, { hosts: [], eventIds: [] })

      args = (arg, t) => [
        arg(seriesId, t.UInt64),
        arg(String(points), t.UInt64),
        arg(reduced.hosts, t.Array(t.Address)),
        arg(reduced.eventIds, t.Array(t.UInt64)),
        arg(title || null, t.Optional(t.String)),
      ]
      break;
    default:
      throw new Error("Unknown type")
  }
  return await generalSendTransaction(code, args,
    eventSeries.AddAchievementGoal.InProgress,
    eventSeries.AddAchievementGoal.Status
  )
}

/**
 * update EventSeries basics
 * 
 * @param {number} seriesId
 * @param {object} basics basic information
 * @param {string} basics.name
 * @param {string} basics.description
 * @param {string} basics.image
 */
export const updateEventseriesBasics = async (seriesId, basics) => {
  return await generalSendTransaction(
    cadence.replaceImportAddresses(cadence.txUpdateEventSeriesBasics, addressMap),
    (arg, t) => [
      arg(seriesId, t.UInt64),
      arg(basics.name, t.String),
      arg(basics.description, t.String),
      arg(basics.image, t.String),
    ],
    eventSeries.UpdateBasics.InProgress,
    eventSeries.UpdateBasics.Status
  )
}

/**
 * update EventSeries slots
 * 
 * @param {number} seriesId
 * @param {object[]} slotsEvents
 * @param {number} slotsEvents.index
 * @param {string} slotsEvents.host
 * @param {number} slotsEvents.eventId
 */
export const updateEventseriesSlots = async (seriesId, slotsEvents) => {
  const reduced = slotsEvents.reduce((all, curr) => {
    if (typeof curr.index === 'string' &&
      typeof curr.host === 'string' &&
      typeof curr.eventId === 'string') {
      all.indexes.push(curr.index)
      all.hosts.push(curr.host)
      all.eventIds.push(curr.eventId)
    }
    return all
  }, { indexes: [], hosts: [], eventIds: [] })

  return await generalSendTransaction(
    cadence.replaceImportAddresses(cadence.txUpdateEventSeriesSlots, addressMap),
    (arg, t) => [
      arg(seriesId, t.UInt64),
      arg(reduced.indexes, t.Array(t.Int)),
      arg(reduced.hosts, t.Array(t.Address)),
      arg(reduced.eventIds, t.Array(t.UInt64)),
    ],
    eventSeries.UpdateSlots.InProgress,
    eventSeries.UpdateSlots.Status
  )
}

export const revokeEventSeries = async (seriesId) => {
  return await generalSendTransaction(
    cadence.replaceImportAddresses(cadence.txRevokeEventSeries, addressMap),
    (arg, t) => [
      arg(seriesId, t.UInt64),
    ],
    eventSeries.Revoke.InProgress,
    eventSeries.Revoke.Status
  )
}

/**
 * add treasury strategy
 * 
 * @param {import('../components/eventseries/types').AddStrategyRequest}
 */
export const addTreasuryStrategy = async ({ seriesId, strategyMode, deliveryMode, options }) => {
  const strategyModeCode = {
    [cadence.STRATEGY_RAFFLE]: '0',
    [cadence.STRATEGY_QUEUE]: '1'
  }[strategyMode]

  const deliveryModeCode = {
    [cadence.DELIVERY_FT_IDENTICAL]: '0',
    [cadence.DELIVERY_FT_RANDOM]: '1',
    [cadence.DELIVERY_NFT]: '2',
  }[deliveryMode]

  if (strategyModeCode === undefined || deliveryModeCode === undefined) {
    throw new Error('Wrong mode')
  }

  return await generalSendTransaction(
    cadence.replaceImportAddresses(cadence.txAddTreasuryStrategy, addressMap),
    (arg, t) => [
      arg(String(seriesId), t.UInt64),
      arg(String(options?.consumable) === 'true', t.Bool),
      arg(String(options?.threshold), t.UInt64),
      arg(options?.autoStart, t.Bool),
      // State Parameters
      arg(typeof options?.pendingEnding !== 'undefined' ?? false, t.Bool),
      arg(options?.pendingEnding?.toFixed(1) ?? '0.0', t.UFix64),
      arg(typeof options?.claimableEnding !== 'undefined' ?? false, t.Bool),
      arg(options?.claimableEnding?.toFixed(1) ?? '0.0', t.UFix64),
      arg(typeof options?.minimumValidAmount !== 'undefined' ?? false, t.Bool),
      arg(options?.minimumValidAmount?.toFixed(0) ?? null, t.Optional(t.UInt64)),
      // Delivery Parameters
      arg(String(strategyModeCode), t.UInt8),
      arg(String(options?.maxClaimableShares ?? 1), t.UInt64),
      arg(String(deliveryModeCode), t.UInt8),
      arg(options?.deliveryTokenIdentifier, t.String),
      arg(options?.deliveryParam1?.toFixed(1) ?? null, t.Optional(t.UFix64)),
    ],
    eventSeries.AddTreasuryStrategy.InProgress,
    eventSeries.AddTreasuryStrategy.Status
  )
}

/**
 * let strategy go to next stage
 * 
 * @param {string} seriesId
 * @param {number} strategyIndex
 */
export const nextTreasuryStrategyStage = async (seriesId, strategyIndex, forceClose = false) => {
  return await generalSendTransaction(
    cadence.replaceImportAddresses(cadence.txNextTreasuryStrategyStage, addressMap),
    (arg, t) => [
      arg(seriesId, t.UInt64),
      arg(String(strategyIndex), t.Int),
      arg(!!forceClose, t.Bool)
    ],
    eventSeries.NextTreasuryStrategyStage.InProgress,
    eventSeries.NextTreasuryStrategyStage.Status,
  )
}

/**
 * deposit fungible token to treasury
 * 
 * @param {import('../components/eventseries/types').TreasuryManagementRequeset}
 */
export const depositFungibleTokenToTreasury = async ({ seriesId, storagePath, publicPath, amount }) => {
  return await generalSendTransaction(
    cadence.replaceImportAddresses(cadence.txDepositFungibleTokenToTreasury, addressMap),
    (arg, t) => [
      arg(seriesId, t.UInt64),
      arg(storagePath, t.String),
      arg(publicPath, t.String),
      arg(amount.toFixed(8), t.UFix64),
    ],
    eventSeries.TreasuryManegement.InProgress,
    eventSeries.TreasuryManegement.Status
  )
}

/**
 * deposit non-fungible token to treasury
 * 
 * @param {import('../components/eventseries/types').TreasuryManagementRequeset}
 */
export const depositNonFungibleTokenToTreasury = async ({ seriesId, storagePath, publicPath, amount }) => {
  return await generalSendTransaction(
    cadence.replaceImportAddresses(cadence.txDepositNonFungibleTokenToTreasury, addressMap),
    (arg, t) => [
      arg(seriesId, t.UInt64),
      arg(storagePath, t.String),
      arg(publicPath, t.String),
      arg(amount.toFixed(0), t.UInt64),
    ],
    eventSeries.TreasuryManegement.InProgress,
    eventSeries.TreasuryManegement.Status,
  )
}

/**
 * Drop treasury's FTs and NFTs
 * 
 * @param {import('../components/eventseries/types').TreasuryManagementRequeset}
 */
export const dropTreasury = async ({ seriesId }) => {
  return await generalSendTransaction(
    cadence.replaceImportAddresses(cadence.txDropTreasury, addressMap),
    (arg, t) => [
      arg(seriesId, t.UInt64),
    ],
    eventSeries.TreasuryManegement.InProgress,
    eventSeries.TreasuryManegement.Status,
  )
}

export const syncCertificateFloats = async ({ seriesId, events }) => {
  const reduced = events.reduce((all, curr) => {
    if (typeof curr.host === 'string' &&
      (typeof curr.id === 'string' || typeof curr.eventId === 'string')) {
      all.hosts.push(curr.host)
      all.eventIds.push(curr.id ?? curr.eventId)
    }
    return all
  }, { hosts: [], eventIds: [] })

  return await generalSendTransaction(
    cadence.replaceImportAddresses(cadence.txSyncCertificates, addressMap),
    (arg, t) => [
      arg(seriesId, t.UInt64),
      arg(reduced.hosts, t.Array(t.Address)),
      arg(reduced.eventIds, t.Array(t.UInt64)),
    ],
    eventSeries.SyncCertificates.InProgress,
    eventSeries.SyncCertificates.Status,
  )
}

// **********************
// ** Events Collector **
// **********************

/**
 * accompllish event series goals
 * 
 * @param {string} host
 * @param {string} seriesId
 * @param {number[]} goals
 */
export const accomplishGoals = async (host, seriesId, goals) => {
  return await generalSendTransaction(
    cadence.replaceImportAddresses(cadence.txAccomplishGoal, addressMap),
    (arg, t) => [
      arg(host, t.Address),
      arg(seriesId, t.UInt64),
      arg(goals.map(one => one.toFixed(0)), t.Array(t.Int)),
    ],
    eventSeries.AccompllishGoals.InProgress,
    eventSeries.AccompllishGoals.Status,
  )
}

/**
 * claim the rewards from event series treasury
 * 
 * @param {string} host 
 * @param {number} seriesId 
 * @param {number} strategyIndex 
 */
export const claimTreasuryRewards = async (host, seriesId, strategyIndex, isNFT, additionalMap = {}) => {
  let code = cadence.replaceImportAddresses(cadence.txClaimTreasuryRewards, addressMap);
  if (isNFT) {
    // setup NFT initialize
    code = code
      .replaceAll('PLACEHOLDER_FT_SETUP', "")
      .replaceAll('PLACEHOLDER_NFT_SETUP', `
        acct.save(<- PLACEHOLDER_CONTRACT.createEmptyCollection(), to: catalogMetadata.collectionData.storagePath)
        acct.link<&PLACEHOLDER_CONTRACT.Collection{PLACEHOLDER_NFT_PUBLIC_RESTRICTIONS, MetadataViews.ResolverCollection, NonFungibleToken.Receiver}>
          (catalogMetadata.collectionData.publicPath, target: catalogMetadata.collectionData.storagePath)
        acct.link<&PLACEHOLDER_CONTRACT.Collection{PLACEHOLDER_NFT_PUBLIC_RESTRICTIONS, MetadataViews.ResolverCollection, NonFungibleToken.Provider}>
          (catalogMetadata.collectionData.privatePath, target: catalogMetadata.collectionData.storagePath)
      `)
  } else {
    // setup FT initialize
    code = code
      .replaceAll('PLACEHOLDER_NFT_SETUP', "")
      .replaceAll('PLACEHOLDER_FT_SETUP', `
        acct.save(<- PLACEHOLDER_CONTRACT.createEmptyVault(), to: PLACEHOLDER_STORAGE_PATH)
        acct.link<&PLACEHOLDER_CONTRACT.Vault{FungibleToken.Receiver}>(
          PLACEHOLDER_FT_RECEIVER_PATH,
          target: PLACEHOLDER_STORAGE_PATH
        )
        acct.link<&PLACEHOLDER_CONTRACT.Vault{FungibleToken.Balance}>(
          PLACEHOLDER_FT_BALANCE_PATH,
          target: PLACEHOLDER_STORAGE_PATH
        )
      `)
  }
  // update placeholders
  for (const key in additionalMap) {
    code = code.replaceAll(key, additionalMap[key])
  }
  return await generalSendTransaction(
    code,
    (arg, t) => [
      arg(host, t.Address),
      arg(seriesId, t.UInt64),
      arg(String(strategyIndex), t.Int),
    ],
    eventSeries.ClaimTreasuryRewards.InProgress,
    eventSeries.ClaimTreasuryRewards.Status,
  )
}

/**
 * refresh user strategies status
 * 
 * @param {string} host 
 * @param {number} seriesId 
 */
export const refreshUserStrategiesStatus = async (host, seriesId) => {
  return await generalSendTransaction(
    cadence.replaceImportAddresses(cadence.txRefreshUserStrategiesStatus, addressMap),
    (arg, t) => [
      arg(host, t.Address),
      arg(seriesId, t.UInt64),
    ],
    eventSeries.RefreshUserStatus.InProgress,
    eventSeries.RefreshUserStatus.Status,
  )
}

// For Dev
export const runCleanUp = async () => {
  return await generalSendTransaction(
    cadence.replaceImportAddresses(cadence.txCleanup, addressMap),
    (arg, t) => [],
    eventSeries.Creation.InProgress,
    eventSeries.Creation.Status,
  )
}

// -------------- Getter - Scripts --------------

// ************************
// ** Event Series Users **
// ************************

/**
 * @returns {import('../components/eventseries/types').Identifier}
 */
const parseEventIdentifier = event => (event ? {
  host: event.host,
  id: event.eventId ?? event.id,
} : undefined)

/**
 * @param {object} item 
 * @returns {import('../components/eventseries/types').EventSeriesData}
 */
const parseEventSeries = (item) => ({
  sequence: item.sequence ? parseInt(item.sequence) : -1,
  identifier: {
    host: item.host,
    id: item.id,
  },
  basics: {
    name: item.display?.name,
    description: item.display?.description,
    image: item.display?.thumbnail?.cid ?? "",
  },
  slots: (item.slots || []).map(one => ({
    required: one.required,
    event: parseEventIdentifier(one.event)
  })),
  extra: item.extra
})

/**
 * Get all event series list
 */
export const getGlobalEventSeriesList = async (page = 0, limit = 20, notClosed = true) => {
  /** @type {import('../components/eventseries/types').EventSeriesData[]} */
  let ret = []
  const raw = await generalQuery(
    cadence.replaceImportAddresses(cadence.scGetGlobalEventSeriesList, addressMap),
    (arg, t) => [
      arg(String(page), t.UInt64),
      arg(String(limit), t.UInt64),
      arg(!!notClosed, t.Bool),
    ],
    []
  )
  if (raw && Object.keys(raw.result ?? {})?.length > 0) {
    ret = Object.values(raw.result).map(parseEventSeries);
  }
  return {
    total: parseInt(raw?.total ?? "0") - 1,
    list: ret
  }
}

/**
 * @param {string} 
 */
export const getEventSeriesList = async (acct) => {
  /** @type {import('../components/eventseries/types').EventSeriesData[]} */
  let ret = []
  const rawDic = await generalQuery(
    cadence.replaceImportAddresses(cadence.scGetEventSeriesList, addressMap),
    (arg, t) => [
      arg(acct, t.Address)
    ],
    []
  )
  if (rawDic && Object.keys(rawDic)?.length > 0) {
    ret = Object.values(rawDic).map(parseEventSeries);
  }
  return ret
}

export const getEventSeries = async (acct, id) => {
  const raw = await generalQuery(
    cadence.replaceImportAddresses(cadence.scGetEventSeries, addressMap),
    (arg, t) => [
      arg(acct, t.Address),
      arg(id, t.UInt64)
    ],
    {}
  )
  if (!raw) return null
  return parseEventSeries(raw)
}

export const getEventSeriesGoals = async (host, id) => {
  const raw = await generalQuery(
    cadence.replaceImportAddresses(cadence.scGetEventSeriesGoals, addressMap),
    (arg, t) => [
      arg(host, t.Address),
      arg(id, t.UInt64),
    ],
    []
  )
  if (!raw) return null
  return raw.map(one => parseRawGoalData(one)).filter(one => !!one)
}

/**
 * @param rawGoal
 * @return {import('../components/eventseries/types').EventSeriesAchievementGoal}
 */
function parseRawGoalData(rawGoal) {
  /** @type {import('../components/eventseries/types').GoalType} */
  let type;
  /** @type {import('../components/eventseries/types').GoalParamsType} */
  let params;
  const typeIdentifer = String(rawGoal.identifer);
  if (typeIdentifer.indexOf("ByAmount") > -1) {
    type = "byAmount";
    if (!rawGoal.detail?.amount || !rawGoal.detail?.requiredAmount)
      return null;
    params = {
      eventsAmount: parseInt(rawGoal.detail?.amount),
      requiredEventsAmount: parseInt(rawGoal.detail?.requiredAmount),
    };
  } else if (typeIdentifer.indexOf("ByPercent") > -1) {
    type = "byPercent";
    if (!rawGoal.detail?.percent) return null;
    params = {
      percent: parseFloat(
        (parseFloat(rawGoal.detail?.percent) * 100).toFixed(2)
      ),
    };
  } else if (typeIdentifer.indexOf("SpecificFLOATs") > -1) {
    type = "bySpecifics";
    if (!rawGoal.detail?.floats || !rawGoal.detail?.floats.length)
      return null;
    params = {
      events: (rawGoal.detail?.floats ?? []).map(parseEventIdentifier),
    };
  } else {
    return null;
  }

  return {
    type,
    title: rawGoal.title ?? "",
    points: parseInt(rawGoal.points),
    status: rawGoal.status.rawValue,
    params,
  };
}

export const getTreasuryData = async (acct, seriesId) => {
  const raw = await generalQuery(
    cadence.replaceImportAddresses(cadence.scGetTreasuryData, addressMap),
    (arg, t) => [
      arg(acct, t.Address),
      arg(seriesId, t.UInt64)
    ],
    null
  )
  if (!raw) return null
  return parseRawTreasuryData(raw)
}

/**
 * @return {import('../components/eventseries/types').TreasuryData}
 */
function parseRawTreasuryData(rawdata) {
  /** @type {{identifier: string , balance: string}[]} */
  const balances = []
  /** @type {{identifier: string , ids: [string]}[]} */
  const ids = []
  for (const key in rawdata.tokenBalances) {
    balances.push({ identifier: key, balance: rawdata.tokenBalances[key] })
  }
  for (const key in rawdata.collectionIDs) {
    ids.push({ identifier: key, ids: rawdata.collectionIDs[key] })
  }
  return {
    tokenBalances: balances,
    collectionIDs: ids
  }
}


/**
 * @return {import('../components/eventseries/types').StrategyDetail}
 */
function parseStrategyDetail(rawdata) {
  const strategyMode = String(rawdata.detail.strategyIdentifier).indexOf('ClaimingQueue') > -1 ? 'queueStrategy' : 'raffleStrategy'
  const strategyStatusMap = {
    '0': 'preparing',
    '1': 'pending',
    '2': 'claimable',
    '3': 'closed'
  }
  const status = rawdata.detail.status || {}
  const deliveryTypeMap = {
    '0': 'ftIdenticalAmount',
    '1': 'ftRandomAmount',
    '2': 'nft'
  }
  const deliveryMode = deliveryTypeMap[status.delivery.type?.rawValue]
  return {
    index: parseInt(rawdata.index),
    strategyMode,
    strategyData: {
      consumable: status.consumable,
      threshold: parseInt(status.threshold),
      pendingEnding: rawdata.detail.strategyData.ending['1'],
      claimableEnding: rawdata.detail.strategyData.ending['2'],
      minValid: strategyMode === 'raffleStrategy' ? rawdata.detail.strategyData.minimiumValid : undefined,
      valid: strategyMode === 'raffleStrategy' ? rawdata.detail.strategyData.valid : undefined,
      winners: strategyMode === 'raffleStrategy' ? rawdata.detail.strategyData.winners : undefined,
    },
    currentState: strategyStatusMap[status?.currentState?.rawValue],
    deliveryMode,
    deliveryStatus: {
      deliveryTokenIdentifier: status.delivery.deliveryTokenType.typeID,
      // status
      maxClaimableShares: parseInt(status.delivery.maxClaimableShares),
      claimedShares: parseInt(status.delivery.claimedShares),
      restAmount: status.delivery.restAmount,
      oneShareAmount: status.delivery.oneShareAmount,
      totalAmount: status.delivery.totalAmount,
    },
    userStatus: rawdata.userAddress ? {
      eligible: rawdata.userInfo.eligible,
      claimable: rawdata.userInfo.claimable,
      claimed: rawdata.userInfo.claimed
    } : null
  }
}

/**
 * @return {Promise<import('../components/eventseries/types').StrategyQueryResult>}
 */
export const getSeriesStrategies = async (acct, seriesId, includingAvailables = false, user = undefined) => {
  const raw = await generalQuery(
    cadence.replaceImportAddresses(cadence.scGetSeriesStrategies, addressMap),
    (arg, t) => [
      arg(acct, t.Address),
      arg(seriesId, t.UInt64),
      arg(includingAvailables, t.Bool),
      arg(user ?? null, t.Optional(t.Address))
    ],
    null
  )
  if (!raw) return null
  return {
    available: raw.available && parseRawTreasuryData(raw.available),
    strategies: raw.strategies.map(one => parseStrategyDetail(one)),
    userTotalScore: raw.userTotalScore,
    userConsumableScore: raw.userConsumableScore,
  }
}

// ***********************
// ** Achievement Board **
// ***********************

/**
 * check if you have achievement board
 * 
 * @param {string} acct
 */
export const hasAchievementBoard = async (acct) => {
  return await generalQuery(
    cadence.replaceImportAddresses(cadence.scHasAchievementBoard, addressMap),
    (arg, t) => [
      arg(acct, t.Address)
    ],
    false
  )
}


/**
 * get records
 * 
 * @param {string} acct
 * @param {string} host
 * @param {number} seriesIds
 */
export const getAchievementRecords = async (acct, host, seriesIds) => {
  return await generalQuery(
    cadence.replaceImportAddresses(cadence.scGetAchievementRecords, addressMap),
    (arg, t) => [
      arg(acct, t.Address),
      arg(host, t.Address),
      arg(seriesIds, t.Array(t.UInt64))
    ],
    []
  )
}

/**
 * get and check goals
 * 
 * @param {string} acct
 * @param {string} host
 * @param {number} seriesId
 * @return {Promise<import('../components/eventseries/types').EventSeriesUserStatus>}
 */
export const getAndCheckEventSeriesGoals = async (acct, host, seriesId) => {
  const raw = await generalQuery(
    cadence.replaceImportAddresses(cadence.scGetAndCheckEventSeriesGoals, addressMap),
    (arg, t) => [
      arg(acct, t.Address),
      arg(host, t.Address),
      arg(seriesId, t.UInt64)
    ],
    {}
  )
  if (!raw) return null
  return {
    goals: raw.goals.map(one => parseRawGoalData(one)).filter(one => !!one),
    owned: raw.owned.map(one => parseEventIdentifier(one)).filter(one => !!one),
    totalScore: parseInt(raw.totalScore) ?? 0,
    consumableScore: parseInt(raw.consumableScore) ?? 0,
  }
}

/**
 * @param {string} acct
 * @param {string[]} paths
 * @returns {Promise<import('../components/eventseries/types').TokenBalance[]>}
 */
export const getTokenBalances = async (acct, paths) => {
  return await generalQuery(
    cadence.replaceImportAddresses(cadence.scGetBalances, addressMap),
    (arg, t) => [
      arg(acct, t.Address),
      arg(paths, t.Array(t.String))
    ],
    []
  )
}

/**
 * @param {string} acct 
 * @returns {Promise<import('../components/eventseries/types').CollectionInfo[]>}
 */
export const getCollectionsNotEmpty = async (acct) => {
  return await generalQuery(
    cadence.replaceImportAddresses(cadence.scGetCollectionsNotEmpty, addressMap),
    (arg, t) => [
      arg(acct, t.Address)
    ],
    []
  )
}

/**
 * @returns {Promise<import('../components/eventseries/types').CollectionInfo[]>}
 */
export const getCollections = async (identifer) => {
  return await generalQuery(
    cadence.replaceImportAddresses(cadence.scGetCollections, addressMap),
    (arg, t) => [
      arg(identifer ?? null, t.Optional(t.String)),
    ],
    []
  )
}

/**
 * @returns {Promise<import('../components/eventseries/types').CollectionInfo>}
 */
export const getCollectionInfo = async function (identifier) {
  const dic = get(cachedCollections) ?? {};
  let info = dic[identifier];
  if (!info) {
    const collections = await getCollections(identifier);
    if (collections && collections[0]) {
      info = collections[0];
      cachedCollections.set(
        Object.assign(dic, { [info.nftIdentifier]: info })
      );
    }
  }
  return info;
}

/**
 * @returns {Promise<boolean[]>}
 */
export const ownsSpecificFloatsAll = async (acct, eventIds) => {
  return await generalQuery(
    cadence.replaceImportAddresses(cadence.scOwnsSpecificFloatsAll, addressMap),
    (arg, t) => [
      arg(acct, t.Address),
      arg(eventIds, t.Array(t.UInt64)),
    ],
    (eventIds ?? []).map(one => false)
  )
}

/**
 * @deprecated
 * @param {string} acct
 */
export const isEmeraldPassActive = async (acct) => {
  throw new Error("Deprecated Method");
  // return await generalQuery(
  //   cadence.replaceImportAddresses(cadence.scIsPassActive, addressMap),
  //   (arg, t) => [
  //     arg(acct, t.Address),
  //   ],
  //   false
  // )
}

/**
 * @deprecated
 * @param {string} acct
 */
export const canCreateNewChallenge = async (acct) => {
  throw new Error("Deprecated Method");
  // return await generalQuery(
  //   cadence.replaceImportAddresses(cadence.scCanCreateNew, addressMap),
  //   (arg, t) => [
  //     arg(acct, t.Address),
  //   ],
  //   false
  // )
}
