import FLOAT from "../FLOAT.cdc"

pub fun main(account: Address, id: UInt64): CombinedMetadata? {
  let floatCollection = getAccount(account).getCapability(FLOAT.FLOATCollectionPublicPath)
                        .borrow<&FLOAT.Collection{FLOAT.CollectionPublic}>()
                        ?? panic("Could not borrow the Collection from the account.")
  if let nft: &FLOAT.NFT = floatCollection.borrowFLOAT(id: id) {
    let eventId = nft.eventId
    let eventHost = nft.eventHost

    let event = nft.getEventMetadata()
    return CombinedMetadata(_float: nft, _totalSupply: event?.totalSupply, _transferrable: event?.transferrable)
  }
  return nil
}

pub struct CombinedMetadata {
    pub let float: &FLOAT.NFT
    pub let totalSupply: UInt64?
    pub let transferrable: Bool?

    init(
        _float: &FLOAT.NFT,
        _totalSupply: UInt64?,
        _transferrable: Bool?
    ) {
        self.float = _float
        self.totalSupply = _totalSupply
        self.transferrable = _transferrable
    }
}