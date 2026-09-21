"use client";
// Turn a dropped File into typed rows. Runs entirely in the browser.

import { detectFile, expectedColumnsMessage } from "./csv";
import { buildConnections, buildInvitations } from "./rows";
import { useApp } from "./store";
import type { Tab } from "./types";

export interface UploadOutcome {
  ok: boolean;
  schema?: Tab;
  intendedSlot: Tab;
  moved: boolean;
  message: string;
}

export async function ingestFile(file: File, intendedSlot: Tab): Promise<UploadOutcome> {
  const text = await file.text();
  const detected = detectFile(text);
  if (!detected) {
    return {
      ok: false,
      intendedSlot,
      moved: false,
      message: `"${file.name}" matches neither LinkedIn export. ${expectedColumnsMessage()}`,
    };
  }
  const schema = detected.schema;
  const moved = schema !== intendedSlot;
  const app = useApp.getState();
  if (schema === "connections") {
    const { rows, stats } = buildConnections(detected, file.name);
    app.setUpload("connections", { rows, stats });
  } else {
    const { rows, stats } = buildInvitations(detected, file.name);
    app.setUpload("invitations", { rows, stats });
  }
  const label = schema === "connections" ? "Connections" : "Invitations";
  return {
    ok: true,
    schema,
    intendedSlot,
    moved,
    message: moved
      ? `"${file.name}" is a ${label} export, so it was moved to the ${label} slot.`
      : `"${file.name}" loaded as ${label}.`,
  };
}
