<script lang="ts">
  import { enhance } from '$app/forms';

  export let form;
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
  <div class="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg">
    <h2 class="text-center text-3xl font-bold tracking-tight">Admin Login</h2>

    <form method="POST" use:enhance class="mt-8 space-y-6">
      <div class="space-y-4">
        <div>
          <label for="username" class="sr-only">Username</label>
          <input
            id="username"
            name="username"
            required
            class="relative block w-full rounded-md border-0 px-4 py-3 ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-1 focus:ring-indigo-600 focus:ring-inset"
            placeholder="Username"
          />
        </div>
        <div>
          <label for="password" class="sr-only">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            class="relative block w-full rounded-md border-0 px-4 py-3 ring-1 ring-gray-300 outline-none ring-inset placeholder:text-gray-400 focus:ring-1 focus:ring-indigo-600 focus:ring-inset"
            placeholder="Password"
          />
        </div>
      </div>

      {#if form?.message}
        <p class="text-center text-sm text-red-600">{form.message}</p>
      {/if}

      <button
        type="submit"
        class="group relative flex w-full justify-center rounded-md bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Login
      </button>
    </form>
  </div>
</div>
