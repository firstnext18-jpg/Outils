import { describe, expect, it } from "vitest";
import {
  durationInput,
  elapsedMinutes,
  formatDuration,
  hoursQuantity,
  parseDuration,
  projectProgress,
} from "@/domain/time";

describe("suivi du temps", () => {
  it("lit les durées saisies de plusieurs façons", () => {
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("1h30")).toBe(90);
    expect(parseDuration("1 h 30")).toBe(90);
    expect(parseDuration("2h")).toBe(120);
    expect(parseDuration("1.5")).toBe(90);
    expect(parseDuration("1,25")).toBe(75);
    expect(parseDuration("45 min")).toBe(45);
    expect(parseDuration("45m")).toBe(45);
    expect(parseDuration("0:20")).toBe(20);
  });

  it("refuse les durées illisibles, nulles ou de plus de 24 h", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("0")).toBeNull();
    expect(parseDuration("25")).toBeNull();
    expect(parseDuration("1:75")).toBeNull();
  });

  it("affiche les durées", () => {
    expect(formatDuration(90)).toBe("1 h 30");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(65)).toBe("1 h 05");
    expect(durationInput(65)).toBe("1:05");
  });

  it("convertit en heures pour la facture", () => {
    expect(hoursQuantity(90)).toBe("1.5");
    expect(hoursQuantity(20)).toBe("0.333");
    expect(hoursQuantity(600)).toBe("10");
  });

  it("chronomètre : minute entamée comptée", () => {
    const start = new Date("2026-11-13T09:00:00Z");
    expect(elapsedMinutes(start, new Date("2026-11-13T09:00:10Z"))).toBe(1);
    expect(elapsedMinutes(start, new Date("2026-11-13T10:30:01Z"))).toBe(91);
  });

  it("avancement d'un projet", () => {
    expect(projectProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
    expect(
      projectProgress([{ doneAt: new Date() }, { doneAt: null }, { doneAt: new Date() }]),
    ).toEqual({ done: 2, total: 3, percent: 67 });
  });
});
