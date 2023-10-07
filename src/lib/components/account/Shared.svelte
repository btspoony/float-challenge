<script>
  import {
    user,
  } from "$flow/stores";
  import { authenticate, unauthenticate } from "$flow/actions";
  import CopyBadge from "$lib/components/common/CopyBadge.svelte";
</script>

<article class="user-info">
  {#if !$user?.loggedIn}
    <button class="contrast small-button" on:click={authenticate}>
      Connect Wallet
    </button>
  {:else}
    <h3 class="mb-1 mt-2">You are currently logged in as</h3>
    <div class="btn-group">
      <button class="outline mb-1">
        <CopyBadge text={$user?.addr}>
          <span class="mono">{$user?.addr}</span>
        </CopyBadge>
      </button>
      <button class="logout" on:click={unauthenticate}>Logout</button>
    </div>
  {/if}
</article>

<style>
  .user-info {
    text-align: center;
    padding: 50px;
  }

  @media screen and (max-width: 410px) {
    .user-info {
      padding:50px 10px;
    }
  }

  .user-info button {
    margin-left: 10px;
    display: inline;
    width: auto;
    padding: 10px;
    margin-bottom: 10px;
  }

  .logout {
    width: 200px;
  }
</style>
