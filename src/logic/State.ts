import { BehaviorSubject } from "rxjs";
import { pairwise } from "rxjs/operators";
import { Tab, CodeTab } from "./tabs";
import { getInitialState } from "./Permalink";

const initialState = getInitialState();

/// All of the user controled global state should be defined here:

export const selectedMinecraftVersion = new BehaviorSubject<string | null>("1.7.10");

export const mobileDrawerOpen = new BehaviorSubject(false);
export const selectedFile = new BehaviorSubject<string | undefined>(initialState.file);
const initialTab = initialState.file ? new CodeTab(initialState.file) : null;
export const openTab = new BehaviorSubject<Tab | null>(initialTab);
export const openTabs = new BehaviorSubject<Tab[]>(initialTab ? [initialTab] : []);
export const tabHistory = new BehaviorSubject<string[]>(initialState.file ? [initialState.file] : []);
export const searchQuery = new BehaviorSubject("");
export const referencesQuery = new BehaviorSubject("");

export interface SelectedLines {
    line: number;
    lineEnd?: number;
}
export const selectedLines = new BehaviorSubject<SelectedLines | null>(initialState.selectedLines);

// Diff between Minecraft versions is disabled in this fork (single 1.7.10 only).
export const diffView = new BehaviorSubject<boolean>(false);
export const diffLeftSelectedMinecraftVersion = new BehaviorSubject<string | null>(null);

// Reset selected lines when file changes (skip initial emission to preserve permalink selection)
selectedFile.pipe(pairwise()).subscribe(([previousFile, currentFile]) => {
    if (previousFile !== currentFile) {
        selectedLines.next(null);
    }
});
