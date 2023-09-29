import "MetadataViews"
import "FLOATEventSeries"
import "FLOATEventSeriesViews"

pub fun main(
  host: Address,
  id: UInt64,
):  FLOATEventSeriesViews.EventSeriesMetadata? {

  let builderRef = getAccount(host)
    .getCapability(FLOATEventSeries.FLOATEventSeriesBuilderPublicPath)
    .borrow<&FLOATEventSeries.EventSeriesBuilder{FLOATEventSeries.EventSeriesBuilderPublic, MetadataViews.ResolverCollection}>()
  
  if builderRef == nil {
    return nil
  }

  let eventSeries = builderRef!.borrowEventSeriesPublic(seriesId: id)
  let resolver = builderRef!.borrowViewResolver(id: id)
  if eventSeries == nil || resolver == nil {
    return nil
  }

  return FLOATEventSeriesViews.EventSeriesMetadata(eventSeries!, resolver)
}
