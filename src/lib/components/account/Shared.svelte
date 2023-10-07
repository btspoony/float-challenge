<script>
  import {
    setupAccountInProgress,
    setupAccountStatus,
    user,
  } from "$flow/stores";
  import {
    isSetup,
    setupAccount,
  } from "$flow/actions";
  import { authenticate, unauthenticate } from "$flow/actions";
  import CopyBadge from "$lib/components/common/CopyBadge.svelte";
</script>

<article class="user-info">
  {#if !$user?.loggedIn}
    <button class="contrast small-button" on:click={authenticate}
      >Connect Wallet</button
    >
  {:else}
    <h2>Welcome to FLOAT</h2>
    <p class="mb-1 mt-2">You are currently logged in as</p>
    <div class="btn-group">
      <button class="outline mb-1">
        <CopyBadge text={$user?.addr}>
          <span class="mono">{$user?.addr}</span>
        </CopyBadge>
      </button>
      <button class="logout" on:click={unauthenticate}>Logout</button>
    </div>
    <br />
    {#await isSetup($user?.addr) then isSetup}
      {#if !isSetup}
        {#if $setupAccountInProgress}
          <button aria-busy="true" disabled>Setting up...</button>
        {:else if $setupAccountStatus.success}
          <button disabled>Successfully set up your account.</button>
        {:else if !$setupAccountStatus.success && $setupAccountStatus.error}
          <button class="error" disabled>
            {$setupAccountStatus.error}
          </button>
        {:else}
          <button disabled={$setupAccountInProgress} on:click={setupAccount}
            >Setup Account
          </button>
        {/if}
      {/if}
    {/await}
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
