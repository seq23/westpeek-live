const fs = require('fs');
function read(file){ if(!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file,'utf8'); }
function requireTokens(file,tokens){ const text=read(file); const missing=tokens.filter(t=>!text.includes(t)); if(missing.length) throw new Error(`${file} missing: ${missing.join(', ')}`); }
// The pre-stream rule lives in lib/video/stageLiveState.ts, shared with the venue menu's Live marker.
requireTokens('lib/video/stageLiveState.ts', ['LIVEKIT_INGRESS','hasEverStarted','export function stageIsLive']);
requireTokens('components/video/StagePlayer.tsx', ['stageShowsPreStream(state)','DAILY','StagePreStreamCard','StageSwitchingOverlay','useStagePlayerPreferences','stage-stream-state','LIVEKIT_DEGRADED']);
if (read('components/video/StagePlayer.tsx').includes('stage-stream-fallback')) throw new Error('Public StagePlayer must not mutate global fallback state directly.');
requireTokens('components/video/LiveKitIngressStagePlayer.tsx', ['initialBufferMs = 4_000','startedOnce','onIngressDropAfterLive','data-testid="attendee-livekit-room-surface"','data-livekit-consumption-state={consumptionState}','token-issued','token-error','loading']);
requireTokens('scripts/tier4_attendee_live_consumption_gauntlet.mjs', ['[data-testid="attendee-livekit-room-surface"][data-livekit-consumption-state="token-issued"]', 'browserLivekitTokenIssued', 'livekitSurfaceTokenIssued', 'stagePlayerLiveKitLive']);
requireTokens('components/video/DailyFallbackStagePlayer.tsx', ['daily-stage-token','muted','volume']);
requireTokens('components/video/useStagePlayerPreferences.ts', ['localStorage','stage-player-preferences','muted','volume']);
console.log('validate_stage_player_ux_contract: PASS');
