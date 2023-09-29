import "MetadataViews"
import "FLOATEventSeries"
import "FLOATEventSeriesViews"

pub fun main(
  host: Address
):  {UInt64: FLOATEventSeriesViews.EventSeriesMetadata} {

  let builderRef = getAccount(host)
    .getCapability(FLOATEventSeries.FLOATEventSeriesBuilderPublicPath)
    .borrow<&FLOATEventSeries.EventSeriesBuilder{FLOATEventSeries.EventSeriesBuilderPublic, MetadataViews.ResolverCollection}>()
  
  if builderRef == nil {
    return {}
  }

  let collection = builderRef!
  let eventSeriesIds: [UInt64] = collection.getIDs() 

  let returnVal: {UInt64: FLOATEventSeriesViews.EventSeriesMetadata} = {}
  for oneId in eventSeriesIds {
    let eventSeries = collection.borrowEventSeriesPublic(seriesId: oneId)
      ?? panic("This event series does not exist in the account.")
    let resolver = collection.borrowViewResolver(id: oneId)
    returnVal[eventSeries.sequence] = FLOATEventSeriesViews.EventSeriesMetadata(eventSeries, resolver)
  }
  return returnVal
}
