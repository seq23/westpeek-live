"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BrowserDiagnosticResult, BrowserReadinessSummary } from "@/types/browserDiagnostics";
import {
  buildTestingIncidentDraft,
  createBrowserDiagnosticResult,
  getBrowserCompatibilityResult,
  getNetworkQualityResult,
  requestCameraStream,
  requestMicrophoneStream,
  stopMediaStream,
  summarizeBrowserReadiness,
} from "@/services/testing";
import { DiagnosticStatusBadge } from "./DiagnosticStatusBadge";

function mapBrowserStatus(status: BrowserDiagnosticResult["status"]) {
  if (status === "pass") return "pass";
  if (status === "warn") return "warn";
  if (status === "fail" || status === "blocked") return "fail";
  if (status === "running") return "pending";
  return "skipped";
}

export function BrowserDiagnosticsPanel({ eventId, onResultsChange }: { eventId: string; onResultsChange?: (summary: BrowserReadinessSummary, results: BrowserDiagnosticResult[]) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [results, setResults] = useState<BrowserDiagnosticResult[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [speakerToneActive, setSpeakerToneActive] = useState(false);

  const summary = useMemo(() => summarizeBrowserReadiness(results), [results]);
  // The speaker tech check records this snapshot on the roster row; the testing console ignores it.
  useEffect(() => { if (onResultsChange && results.length) onResultsChange(summary, results); }, [onResultsChange, summary, results]);
  const incidentDrafts = useMemo(
    () => results.filter((result) => ["fail", "blocked", "warn"].includes(result.status)).map((result) => buildTestingIncidentDraft({ eventId, result })),
    [eventId, results],
  );

  function upsertResult(next: BrowserDiagnosticResult) {
    setResults((current) => [next, ...current.filter((result) => result.kind !== next.kind)]);
  }

  function runCompatibilityAndNetworkChecks() {
    upsertResult(getBrowserCompatibilityResult());
    upsertResult(getNetworkQualityResult());
  }

  async function runCameraCheck() {
    upsertResult(createBrowserDiagnosticResult({
      kind: "camera_permission",
      label: "Camera permission",
      status: "running",
      severity: "medium",
      summary: "Requesting camera permission.",
      recommendedAction: "Approve the browser camera prompt.",
    }));

    try {
      stopMediaStream(cameraStreamRef.current);
      const stream = await requestCameraStream();
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      upsertResult(createBrowserDiagnosticResult({
        kind: "camera_permission",
        label: "Camera permission",
        status: "pass",
        severity: "low",
        summary: "Camera permission granted.",
        recommendedAction: "Confirm framing, lighting, and eye-line before showtime.",
        metadata: { videoTracks: stream.getVideoTracks().length },
      }));
      upsertResult(createBrowserDiagnosticResult({
        kind: "camera_preview",
        label: "Camera preview",
        status: "pass",
        severity: "low",
        summary: "Camera preview is active in the testing console.",
        recommendedAction: "Keep this device selected for the live room unless the producer requests a change.",
      }));
    } catch (error) {
      upsertResult(createBrowserDiagnosticResult({
        kind: "camera_permission",
        label: "Camera permission",
        status: "blocked",
        severity: "critical",
        summary: error instanceof Error ? error.message : "Camera permission was blocked.",
        recommendedAction: "Enable camera permission in browser settings, refresh, and rerun diagnostics before joining live production.",
      }));
    }
  }

  async function runMicrophoneCheck() {
    upsertResult(createBrowserDiagnosticResult({
      kind: "microphone_permission",
      label: "Microphone permission",
      status: "running",
      severity: "medium",
      summary: "Requesting microphone permission.",
      recommendedAction: "Approve the browser microphone prompt and speak normally.",
    }));

    try {
      stopMediaStream(micStreamRef.current);
      const stream = await requestMicrophoneStream();
      micStreamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let peak = 0;

      const sample = () => {
        analyser.getByteFrequencyData(data);
        peak = Math.max(peak, Math.round((Math.max(...Array.from(data)) / 255) * 100));
        setMicLevel(peak);
      };

      const interval = window.setInterval(sample, 100);
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      window.clearInterval(interval);

      upsertResult(createBrowserDiagnosticResult({
        kind: "microphone_permission",
        label: "Microphone permission",
        status: "pass",
        severity: "low",
        summary: "Microphone permission granted.",
        recommendedAction: "Confirm the selected microphone matches the show plan.",
        metadata: { audioTracks: stream.getAudioTracks().length },
      }));
      upsertResult(createBrowserDiagnosticResult({
        kind: "microphone_level",
        label: "Microphone input meter",
        status: peak > 8 ? "pass" : "warn",
        severity: peak > 8 ? "low" : "high",
        summary: peak > 8 ? "Microphone input detected." : "Microphone permission is active, but input level is low.",
        recommendedAction: peak > 8 ? "Proceed to speaker test tone." : "Ask the participant to select the correct microphone, unmute hardware, or speak closer to the mic.",
        metadata: { peakInputPercent: peak },
      }));
    } catch (error) {
      upsertResult(createBrowserDiagnosticResult({
        kind: "microphone_permission",
        label: "Microphone permission",
        status: "blocked",
        severity: "critical",
        summary: error instanceof Error ? error.message : "Microphone permission was blocked.",
        recommendedAction: "Enable microphone permission in browser settings, refresh, and rerun diagnostics before joining live production.",
      }));
    }
  }

  async function runSpeakerTone() {
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = 440;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      setSpeakerToneActive(true);
      oscillator.start();
      await new Promise((resolve) => window.setTimeout(resolve, 800));
      oscillator.stop();
      setSpeakerToneActive(false);
      upsertResult(createBrowserDiagnosticResult({
        kind: "speaker_tone",
        label: "Speaker test tone",
        status: "pass",
        severity: "low",
        summary: "Speaker test tone played from this browser.",
        recommendedAction: "Ask the participant to verbally confirm they heard the tone clearly.",
      }));
    } catch (error) {
      setSpeakerToneActive(false);
      upsertResult(createBrowserDiagnosticResult({
        kind: "speaker_tone",
        label: "Speaker test tone",
        status: "fail",
        severity: "high",
        summary: error instanceof Error ? error.message : "Speaker tone could not be played.",
        recommendedAction: "Check browser audio output, OS output device, and hardware volume before showtime.",
      }));
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Real browser diagnostics</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Camera, mic, speaker, browser, and network checks</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            These checks run in the operator or participant browser. They do not join a real video provider yet; they prove the device/browser layer before Phase 7 room integration.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
          <p className="text-xs uppercase tracking-wide text-slate-400">Readiness</p>
          <p className="text-xl font-semibold">{summary.status.replace(/_/g, " ").toUpperCase()} · {summary.score}%</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-2xl bg-slate-950 object-cover" />
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">Microphone peak</span>
              <span className="font-semibold text-slate-950">{micLevel}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-slate-950 transition-all" style={{ width: `${Math.min(micLevel, 100)}%` }} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={runCompatibilityAndNetworkChecks} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Browser + network</button>
            <button onClick={runCameraCheck} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Camera preview</button>
            <button onClick={runMicrophoneCheck} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Mic meter</button>
            <button onClick={runSpeakerTone} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">{speakerToneActive ? "Playing tone…" : "Speaker tone"}</button>
          </div>
        </div>

        <div className="space-y-3">
          <div className={`rounded-2xl p-4 ${summary.status === "not_ready" ? "bg-rose-50 text-rose-900" : summary.status === "monitor" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
            <p className="font-semibold">Producer summary</p>
            <p className="mt-1 text-sm">{summary.producerSummary}</p>
            <p className="mt-2 text-xs">Blocking failures: {summary.blockingFailures} · warnings: {summary.warningCount}</p>
          </div>

          {results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Run diagnostics to create a readiness record.</div>
          ) : (
            results.map((result) => (
              <div key={`${result.kind}-${result.measuredAt}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{result.label}</p>
                    <p className="mt-1 text-sm text-slate-600">{result.summary}</p>
                  </div>
                  <DiagnosticStatusBadge status={mapBrowserStatus(result.status)} />
                </div>
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{result.recommendedAction}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {incidentDrafts.length > 0 && (
        <div className="mt-5 rounded-2xl bg-slate-50 p-4">
          <p className="font-semibold text-slate-950">Testing incident handoff preview</p>
          <p className="mt-1 text-sm text-slate-600">Failures and warnings are shaped as incident drafts for the Phase 5 testing console incident table.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {incidentDrafts.map((incident) => (
              <div key={`${incident.diagnosticType}-${incident.title}`} className="rounded-xl bg-white p-3 text-sm text-slate-700">
                <strong>{incident.title}</strong> · {incident.severity} · {incident.status}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
