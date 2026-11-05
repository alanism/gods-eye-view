<script setup>
import { computed } from 'vue';
import { t } from '../../i18n/index.js';

const props = defineProps({ view: { type: Object, required: true } });
const heading = computed(() => props.view.camera?.heading);
const hasHeading = computed(() => Number.isFinite(heading.value));
const headingLabel = computed(() =>
  hasHeading.value
    ? `${String(Math.round(heading.value) % 360).padStart(3, '0')}°`
    : '---°',
);
const pitchLabel = computed(() =>
  Number.isFinite(props.view.camera?.pitch)
    ? `${props.view.camera.pitch.toFixed(1)}°`
    : '---°',
);
const altitudeLabel = computed(() =>
  Number.isFinite(props.view.camera?.altitude)
    ? `${props.view.camera.altitude.toLocaleString()} m`
    : '--- m',
);
const layoutName = computed(
  () =>
    ({ aperture: t('Aperture'), survey: t('Survey'), signal: t('Signal') })[
      props.view.variant
    ],
);
const layoutCode = computed(
  () => ({ aperture: '01', survey: '02', signal: '03' })[props.view.variant],
);
const time = computed(() => props.view.timestamp?.split(' ')[1] ?? '--:--:--Z');
// Static geometry is created once, outside the 4 Hz telemetry computations.
const ticks = Array.from({ length: 120 }, (_, i) => ({
  angle: i * 3,
  major: i % 10 === 0,
  medium: i % 5 === 0,
}));
const bearings = Array.from({ length: 12 }, (_, i) => {
  const radians = (i * Math.PI) / 6;
  return {
    angle: i * 30,
    x: 300 + Math.sin(radians) * 283,
    y: 300 - Math.cos(radians) * 283,
  };
});
const divisions = Array.from({ length: 41 }, (_, i) => ({
  offset: (i - 20) * 13,
  major: i % 5 === 0,
}));
const ruler = computed(() => {
  if (!hasHeading.value) return [];
  const base = Math.floor(heading.value / 10) * 10;
  return Array.from({ length: 9 }, (_, i) => ({
    x: 160 + (base + (i - 4) * 10 - heading.value) * 4,
    label: String((base + (i - 4) * 10 + 360) % 360).padStart(3, '0'),
  }));
});
</script>

<template>
  <div class="instrument-hud" :data-instrument="view.variant">
    <div class="instrument-dot-field" aria-hidden="true"></div>
    <div class="instrument-ident">
      <span class="instrument-index">{{ layoutCode }} /</span>
      <span class="instrument-name">{{ layoutName }}</span>
      <span class="instrument-subtitle">{{ t('Camera overlay') }}</span>
    </div>
    <div class="instrument-clock">
      <span class="instrument-live-dot" aria-hidden="true"></span>
      <span>{{ time }}</span>
      <span class="instrument-subtitle">{{ t('UTC') }}</span>
    </div>

    <div class="instrument-heading" :aria-label="t('Camera heading')">
      <div class="instrument-heading-value"
        ><span>{{ t('HDG') }}</span> {{ headingLabel }}</div
      >
      <svg viewBox="0 0 320 38" aria-hidden="true">
        <path d="M0 29H320" class="instrument-faint" />
        <g v-for="mark in ruler" :key="mark.label">
          <path :d="`M${mark.x} 23v12`" />
          <text :x="mark.x" y="14" text-anchor="middle">{{ mark.label }}</text>
        </g>
        <path d="M155 19l5 7 5-7" class="instrument-accent-fill" />
      </svg>
    </div>

    <svg
      v-if="view.variant !== 'survey'"
      class="instrument-disc"
      viewBox="0 0 600 600"
      fill="none"
      aria-hidden="true"
    >
      <template v-if="view.variant === 'aperture'">
        <g :transform="`rotate(${-1 * (heading ?? 0)} 300 300)`">
          <circle cx="300" cy="300" r="258" class="instrument-faint" />
          <g
            v-for="tick in ticks"
            :key="tick.angle"
            :transform="`rotate(${tick.angle} 300 300)`"
          >
            <path
              :d="`M300 42v${tick.major ? 20 : tick.medium ? 11 : 4}`"
              :class="{ 'instrument-faint': !tick.medium }"
            />
          </g>
          <text
            v-for="bearing in bearings"
            :key="bearing.angle"
            :x="bearing.x"
            :y="bearing.y + 4"
            :transform="`rotate(${heading ?? 0} ${bearing.x} ${bearing.y})`"
            text-anchor="middle"
            :class="{ 'instrument-accent-text': bearing.angle === 0 }"
          >
            {{
              bearing.angle === 0 ? 'N' : String(bearing.angle).padStart(3, '0')
            }}
          </text>
        </g>
        <circle
          cx="300"
          cy="300"
          r="226"
          stroke-dasharray="130 47.5"
          stroke-dashoffset="-23"
        />
        <circle
          cx="300"
          cy="300"
          r="213"
          stroke-dasharray="2 333"
          class="instrument-faint"
        />
        <path d="M300 24l-5-9h10Z" class="instrument-accent-fill" />
        <path d="M50 300h30m440 0h30M300 50v30m0 440v30" />
        <path d="M286 300h8m12 0h8m-14-14v8m0 12v8" />
        <circle cx="300" cy="300" r="2" class="instrument-accent-fill" />
      </template>
      <template v-else>
        <circle
          cx="300"
          cy="300"
          r="258"
          stroke-dasharray="1 15.2"
          stroke-linecap="round"
          stroke-width="2"
          class="instrument-faint"
        />
        <circle cx="300" cy="300" r="236" />
        <circle
          cx="300"
          cy="300"
          r="219"
          stroke-dasharray="273 71"
          stroke-dashoffset="-35"
        />
        <circle
          cx="300"
          cy="300"
          r="160"
          stroke-dasharray="1 12"
          stroke-linecap="round"
          class="instrument-faint"
        />
        <g
          v-for="angle in [0, 90, 180, 270]"
          :key="angle"
          :transform="`rotate(${angle} 300 300)`"
        >
          <path d="M300 25v115m-8-4h16" />
          <circle cx="300" cy="64" r="7" />
          <path d="M300 60v8m-4-4h8" />
        </g>
        <path
          d="M91 91l91 91m236 236 91 91M91 509l91-91m236-236 91-91"
          class="instrument-faint"
        />
        <path
          d="M234 258v-24h24m84 0h24v24m0 84v24h-24m-84 0h-24v-24"
          stroke-width="2"
        />
        <circle cx="300" cy="300" r="2" class="instrument-accent-fill" />
        <g :transform="`rotate(${heading ?? 0} 300 300)`">
          <path d="M300 42l-5-10h10Z" class="instrument-accent-fill" />
        </g>
      </template>
    </svg>

    <div v-else class="instrument-survey" aria-hidden="true">
      <i
        v-for="corner in ['tl', 'tr', 'bl', 'br']"
        :key="corner"
        :class="['instrument-fiducial', corner]"
      ></i>
      <svg viewBox="0 0 600 400" preserveAspectRatio="none" fill="none">
        <path
          d="M26 200H290m20 0h264M300 20v170m0 20v170"
          class="instrument-faint"
          stroke-dasharray="3 5"
        />
        <g v-for="tick in divisions" :key="tick.offset">
          <path
            :d="`M${300 + tick.offset} ${tick.major ? 193 : 197}v${tick.major ? 14 : 6}`"
          />
          <path
            v-if="Math.abs(tick.offset) < 175"
            :d="`M${tick.major ? 293 : 297} ${200 + tick.offset}h${tick.major ? 14 : 6}`"
          />
          <text
            v-if="tick.major && tick.offset !== 0"
            :x="300 + tick.offset"
            y="226"
            text-anchor="middle"
          >
            {{ tick.offset > 0 ? '+' : '' }}{{ tick.offset / 65 }}
          </text>
        </g>
        <rect x="292" y="192" width="16" height="16" />
        <circle cx="300" cy="200" r="1.5" class="instrument-accent-fill" />
      </svg>
      <span class="instrument-survey-note">{{ t('Screen divisions') }}</span>
    </div>

    <div class="instrument-foot">
      <span
        >{{ t('HDG') }} <b>{{ headingLabel }}</b></span
      >
      <span class="instrument-foot-divider" aria-hidden="true"></span>
      <span
        >{{ t('PITCH') }} <b>{{ pitchLabel }}</b></span
      >
      <span class="instrument-mobile-alt" :aria-label="t('Camera altitude MSL')"
        >{{ t('ALT') }} <b>{{ altitudeLabel }}</b></span
      >
    </div>
  </div>
</template>
