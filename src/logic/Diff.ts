// Diff between Minecraft versions is disabled in this fork (single 1.7.10 only).
// File kept as a no-op stub so existing diff UI files compile but never instantiate.
import { BehaviorSubject, EMPTY, type Observable } from "rxjs";
import { type MinecraftJar } from "./MinecraftApi";
import type { DecompileResult } from "../workers/decompile/types";

export const hideUnchangedSizes = new BehaviorSubject<boolean>(false);

export interface EntryInfo {
    classCrcs: Map<string, number>;
    totalUncompressedSize: number;
}

export interface DiffSide {
    selectedVersion: BehaviorSubject<string | null>;
    jar: Observable<MinecraftJar>;
    entries: Observable<Map<string, EntryInfo>>;
    result: Observable<DecompileResult>;
}

export const leftDownloadProgress = new BehaviorSubject<number | undefined>(undefined);

const disabledSide: DiffSide = {
    selectedVersion: new BehaviorSubject<string | null>(null),
    jar: EMPTY as Observable<MinecraftJar>,
    entries: EMPTY as Observable<Map<string, EntryInfo>>,
    result: EMPTY as Observable<DecompileResult>,
};

export function getLeftDiff(): DiffSide {
    return disabledSide;
}

export function getRightDiff(): DiffSide {
    return disabledSide;
}

export interface DiffSummary {
    added: number;
    deleted: number;
    modified: number;
}

export interface ChangeInfo {
    state: ChangeState;
    additions?: number;
    deletions?: number;
}

export function getDiffChanges(): Observable<Map<string, ChangeInfo>> {
    return EMPTY as Observable<Map<string, ChangeInfo>>;
}

export function getDiffSummary(): Observable<DiffSummary> {
    return EMPTY as Observable<DiffSummary>;
}

export type ChangeState = "added" | "deleted" | "modified";
