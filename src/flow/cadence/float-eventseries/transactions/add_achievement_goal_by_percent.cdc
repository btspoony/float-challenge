import "MetadataViews"
import "FLOATEventSeries"
import "FLOATEventSeriesGoals"

transaction(
  seriesId: UInt64,
  points: UInt64,
  percent: UFix64,
  title: String?
) {
  let eventSeries: &FLOATEventSeries.EventSeries

  prepare(acct: AuthAccount) {
    // SETUP Event Series builder resource, link public and private
    if acct.borrow<&FLOATEventSeries.EventSeriesBuilder>(from: FLOATEventSeries.FLOATEventSeriesBuilderStoragePath) == nil {
      acct.save(<- FLOATEventSeries.createEventSeriesBuilder(), to: FLOATEventSeries.FLOATEventSeriesBuilderStoragePath)
      acct.link<&FLOATEventSeries.EventSeriesBuilder{FLOATEventSeries.EventSeriesBuilderPublic, MetadataViews.ResolverCollection}>
          (FLOATEventSeries.FLOATEventSeriesBuilderPublicPath, target: FLOATEventSeries.FLOATEventSeriesBuilderStoragePath)
    }

    let serieshelf = acct.borrow<&FLOATEventSeries.EventSeriesBuilder>(from: FLOATEventSeries.FLOATEventSeriesBuilderStoragePath)
      ?? panic("Could not borrow the Event Series builder.")
    
    self.eventSeries = serieshelf.borrowEventSeries(seriesId: seriesId)
      ?? panic("Could not borrow the event series private.")
  }

  pre {
    points > 0: "points should be greator then zero"
  }

  execute {
    let goal = FLOATEventSeriesGoals.CollectByPercentGoal(
      points: points,
      percentToCollect: percent,
      title: title
    )
    self.eventSeries.addAchievementGoal(goal: goal)

    log("A achievement goal have been added to a FLOAT EventSeries.")
  }
}
