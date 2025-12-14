<template>
    <div class="flex flex-col gap-10 overflow-x-hidden" :class="{ hidden: !maxNumCores }">
        ...
        <!-- RDP Monitoring (existing, unchanged) -->
        <x-card
            class="flex flex-row justify-between items-center p-2 py-3 my-0 w-full backdrop-blur-xl backdrop-brightness-150 bg-neutral-800/20"
        >
            <div>
                <div class="flex flex-row gap-2 items-center mb-2">
                    <Icon class="inline-flex text-violet-400 size-8" icon="fluent:remote-16-filled"></Icon>
                    <h1 class="my-0 text-lg font-semibold">RDP Monitoring</h1>
                </div>
                <p class="text-neutral-400 text-[0.9rem] !pt-0 !mt-0">
                    If enabled, a banner will appear when the RDP session is connected (may cause high CPU
                    usage, disable if you notice performance issues)
                </p>
            </div>
            <div class="flex flex-row gap-2 justify-center items-center">
                <x-switch
                    :toggled="wbConfig.config.rdpMonitoringEnabled"
                    @toggle="toggleRdpMonitoring"
                    size="large"
                ></x-switch>
            </div>
        </x-card>

        <!-- Shutdown Timer UI - visible only when RDP monitoring is enabled -->
        <x-card v-show="wbConfig.config.rdpMonitoringEnabled" class="flex flow-row justify-between items-center p-2 py-3 my-0 w-full backdrop-blur-xl backdrop-brightness-150 bg-neutral-800/20">
            <div>
                <div class="flex flex-row gap-2 items-center mb-2">
                    <Icon class="inline-flex text-violet-400 size-8" icon="fluent:power-20-filled"></Icon>
                    <h1 class="text-lg my-0 font-semibold">Shutdown Timer</h1>
                </div>
                <p class="text-neutral-400 text-[0.9rem] !pt-0 !mt-0">
                    If enabled, the Windows VM will shutdown if there hasn't been an RDP session within a set amount of time.
                </p>
            </div>
            <div class="flex flex-row justify-center items-center gap-2">
                <x-switch
                    :toggled="wbConfig.config.shutdownTimer"
                    @toggle="toggleShutdownTimer"
                    size="large"
                ></x-switch>
            </div>
        </x-card>

        <!-- Timer Length (minutes) -->
        <x-card v-show="wbConfig.config.rdpMonitoringEnabled" class="flex flow-row justify-between items-center p-2 py-3 my-0 w-full backdrop-blur-xl backdrop-brightness-150 bg-neutral-800/20">
            <div>
                <div class="flex flex-row gap-2 items-center mb-2">
                    <Icon class="inline-flex text-violet-400 size-8" icon="fluent:hourglass-three-quarter-16-regular"></Icon>
                    <h1 class="text-lg my-0 font-semibold">Timer Length</h1>
                </div>
                <p class="text-neutral-400 text-[0.9rem] !pt-0 !mt-0">
                    The length of inactivity before shutting down the VM.
                </p>
            </div>
            <div class="flex flex-row gap-2 justify-center items-center">
                <x-input
                    type="text"
                    class="max-w-16 text-right text-[1.1rem]"
                    :value="timerLength / 60000"
                    v-on:keydown="(e: any) => ensureNumericInput(e)"
                    v-on:blur="(e: any) => updateTimerLength(e.target.value * 60000)"
                ></x-input>
                <p class="text-neutral-100">Minutes</p>
            </div>
        </x-card>

        ...
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { computedAsync } from "@vueuse/core";
import { Winboat } from "../lib/winboat";
import { ContainerRuntimes, ContainerStatus } from "../lib/containers/common";
import type { ComposeConfig } from "../../types";
import { getSpecs } from "../lib/specs";
import { Icon } from "@iconify/vue";
import { RdpArg, WinboatConfig } from "../lib/config";
import { USBManager, type PTSerializableDeviceInfo } from "../lib/usbmanager";
import { type Device } from "usb";
import {
    USB_VID_BLACKLIST,
    RESTART_ON_FAILURE,
    RESTART_NO,
    GUEST_RDP_PORT,
    GUEST_QMP_PORT,
} from "../lib/constants";
import { ComposePortEntry, ComposePortMapper, Range } from "../utils/port";
const { app }: typeof import("@electron/remote") = require("@electron/remote");
const { promisify }: typeof import("node:util") = require("node:util");
const path: typeof import("node:path") = require("node:path");
const fs: typeof import("node:fs") = require("node:fs");
const statAsync = promisify(fs.stat);

// Emits
const $emit = defineEmits(["rerender"]);

// For Resources
const compose = ref<ComposeConfig | null>(null);
const numCores = ref(0);
const origNumCores = ref(0);
const maxNumCores = ref(0);
const ramGB = ref(0);
const origRamGB = ref(0);
const origShareHomeFolder = ref(false);
const shareHomeFolder = ref(false);
const origAutoStartContainer = ref(false);
const autoStartContainer = ref(false);
const freerdpPort = ref(0);
const origFreerdpPort = ref(0);
const isApplyingChanges = ref(false);
const resetQuestionCounter = ref(0);
const isResettingWinboat = ref(false);
const isUpdatingUSBPrerequisites = ref(false);
const origApplicationScale = ref(0);
const rdpArgs = ref<RdpArg[]>([]);

// For RDP Args
const rerenderAdvanced = ref(0);

// For handling the QMP port
let portMapper = ref<ComposePortMapper | null>(null);

// For General
const wbConfig = WinboatConfig.getInstance();
const winboat = Winboat.getInstance();
const usbManager = USBManager.getInstance();

// New: timerLength ref (milliseconds)
const timerLength = ref(0);

onMounted(async () => {
    await assignValues();
});

watch(
    rdpArgs,
    newArgs => {
        wbConfig.config.rdpArgs = newArgs;
    },
    { deep: 2 },
);

function ensureNumericInput(e: any) {
    if (e.metaKey || e.ctrlKey || e.which <= 0 || e.which === 8 || e.key === "ArrowRight" || e.key === "ArrowLeft") {
        return;
    }

    if (!/\d/.test(e.key)) {
        e.preventDefault();
    }
}

function updateApplicationScale(value: string | number) {
    let val = typeof value === "string" ? Number.parseInt(value) : value;
    const clamped = typeof val !== "number" || Number.isNaN(val) ? 100 : Math.min(Math.max(100, val), 500);
    wbConfig.config.scaleDesktop = clamped;
    origApplicationScale.value = clamped;
}

/**
 * Assigns the initial values from the Compose file to the reactive refs
 */
async function assignValues() {
    compose.value = Winboat.readCompose(winboat.containerMgr!.composeFilePath);
    portMapper.value = new ComposePortMapper(compose.value);

    numCores.value = Number(compose.value.services.windows.environment.CPU_CORES);
    origNumCores.value = numCores.value;

    ramGB.value = Number(compose.value.services.windows.environment.RAM_SIZE.split("G")[0]);
    origRamGB.value = ramGB.value;

    shareHomeFolder.value = compose.value.services.windows.volumes.includes(HOMEFOLDER_SHARE_STR);
    origShareHomeFolder.value = shareHomeFolder.value;

    autoStartContainer.value = compose.value.services.windows.restart === RESTART_ON_FAILURE;
    origAutoStartContainer.value = autoStartContainer.value;

    freerdpPort.value = (portMapper.value.getShortPortMapping(GUEST_RDP_PORT)?.host as number) ?? GUEST_RDP_PORT;
    origFreerdpPort.value = freerdpPort.value;

    origApplicationScale.value = wbConfig.config.scaleDesktop;

    rdpArgs.value = wbConfig.config.rdpArgs;

    const specs = await getSpecs();
    maxRamGB.value = specs.ramGB;
    maxNumCores.value = specs.cpuCores;

    // New: initialize timerLength from config (ms)
    timerLength.value = wbConfig.config.timerLength ?? 5 * 60 * 1000;

    refreshAvailableDevices();
}

function updateTimerLength(value: string | number) {
    let val = typeof value === "string" ? parseInt(value) : value;
    if (Number.isNaN(val)) val = 0;
    wbConfig.config.timerLength = val;
    timerLength.value = val;
}

async function toggleShutdownTimer() {
    wbConfig.config.shutdownTimer = !wbConfig.config.shutdownTimer;
    rerenderAdvanced.value++;
}

async function toggleRdpMonitoring() {
    wbConfig.config.rdpMonitoringEnabled = !wbConfig.config.rdpMonitoringEnabled;
    rerenderAdvanced.value++;
}

/* rest of file unchanged (save/compose, USB code, etc.) */
</script>

<style scoped>
/* existing styles */
</style>
