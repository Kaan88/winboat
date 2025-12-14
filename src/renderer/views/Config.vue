<template>
  <div class="config-page">
    <h2>Application Configuration</h2>

    <!-- Other existing configuration sections would be here -->

    <section class="config-section shutdown-timer">
      <h3>Shutdown Timer</h3>
      <div class="form-row">
        <label>
          <input type="checkbox" v-model="shutdownEnabled" /> Enable shutdown timer
        </label>
      </div>

      <div class="form-row" v-if="shutdownEnabled">
        <label for="timerLength">Timer length (minutes)</label>
        <input
          id="timerLength"
          type="number"
          min="1"
          step="1"
          v-model.number="timerMinutes"
        />
        <p class="help">When the timer is enabled, the app will schedule a shutdown after the specified time.</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { config } from '../lib/config';

// Bind to the reactive config from src/renderer/lib/config.ts
const shutdownEnabled = computed<boolean>({
  get: () => !!config.shutdownTimer,
  set: (v: boolean) => {
    config.shutdownTimer = !!v;
  },
});

// Expose timer length in minutes for a better UX; store as seconds internally
const timerMinutes = computed<number>({
  get: () => Math.max(1, Math.round((config.timerLength || 300) / 60)),
  set: (minutes: number) => {
    const m = Math.max(1, Math.round(minutes));
    config.timerLength = m * 60; // store in seconds
  },
});
</script>

<style scoped>
.config-page {
  padding: 16px;
}
.config-section {
  margin-top: 20px;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 6px;
}
.form-row {
  margin: 8px 0;
}
label {
  display: flex;
  align-items: center;
  gap: 8px;
}
input[type="number"] {
  width: 100px;
}
.help {
  margin-top: 6px;
  color: #666;
  font-size: 13px;
}
</style>
