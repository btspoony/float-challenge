<script>
  import { t } from "svelte-i18n";
  import IntersectionObserver from "svelte-intersection-observer";
  import Loading from "$lib/components/common/Loading.svelte";
  import SeriesCard from "$lib/components/eventseries/SeriesCard.svelte";

  /** @type {import('./types').EventSeriesData[]} */
  export let list = [];

  const maxSize = 3;
  let currentAnchor = 0;

  $: total = list.length;
  $: sortedList = list.slice(0).sort((a, b) => b.sequence - a.sequence);
  $: slicedList = sortedList.slice(0, Math.min(total, currentAnchor + maxSize));

  let moreInView;
</script>

{#each slicedList as item}
  <SeriesCard eventSeriesData={item} />
{:else}
  <p class="text-center">{$t("challenges.list.no-challege")}</p>
{/each}

{#if currentAnchor + maxSize < total}
  <IntersectionObserver
    element={moreInView}
    on:intersect={function () {
      currentAnchor += maxSize;
    }}
    let:intersecting
  >
    <div bind:this={moreInView}>
      {#if intersecting}
        <Loading />
      {/if}
    </div>
  </IntersectionObserver>
{/if}
