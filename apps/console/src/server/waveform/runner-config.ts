import "server-only";

export const waveformRunnerConfig = {
  socketPath: "/run/oioi-waveform/runner.sock",
  deadlineMs: 2000,
  maxResponseBytes: 1024,
  maxInFlight: 8,
} as const;
