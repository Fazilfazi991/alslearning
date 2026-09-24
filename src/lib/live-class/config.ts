import "server-only";

const enabled = (name: string) => process.env[name]?.trim().toLowerCase() === "true";

export type LiveClassConfiguration = {
  pocEnabled: boolean;
  classroomEnabled: boolean;
  recordingEnabled: boolean;
  realtimeConfigured: boolean;
  r2Configured: boolean;
  turnConfigured: boolean;
  missingRealtime: string[];
  missingR2: string[];
  missingTurn: string[];
};

export function liveClassConfiguration(): LiveClassConfiguration {
  const missingRealtime = ["CF_REALTIME_APP_ID", "CF_REALTIME_APP_SECRET"].filter(name => !process.env[name]);
  const missingR2 = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"].filter(name => !process.env[name]);
  const missingTurn = ["CF_TURN_KEY_ID", "CF_TURN_KEY_API_TOKEN"].filter(name => !process.env[name]);
  return {
    pocEnabled: enabled("ALS_LIVE_POC_ENABLED"),
    classroomEnabled: enabled("ALS_LIVE_CLASS_ENABLED"),
    recordingEnabled: enabled("ALS_LIVE_RECORDING_ENABLED"),
    realtimeConfigured: missingRealtime.length === 0,
    r2Configured: missingR2.length === 0,
    turnConfigured: missingTurn.length === 0,
    missingRealtime,
    missingR2,
    missingTurn,
  };
}

export function assertLiveFeature(mode: "poc" | "classroom" | "recording") {
  const configuration = liveClassConfiguration();
  if (mode === "poc" && !configuration.pocEnabled) throw new Error("The isolated live classroom POC is disabled");
  if (mode === "classroom" && !configuration.classroomEnabled) throw new Error("Normal live-class entry is disabled");
  if (mode === "recording" && !configuration.recordingEnabled) throw new Error("Live-class recording is disabled");
  return configuration;
}
