import { combineLatest } from "rxjs";
import { resetPermalinkAffectingSettings, supportsPermalinking } from "./Settings";
import { selectedFile, selectedLines, selectedMinecraftVersion } from "./State";

export interface State {
    version: number;
    minecraftVersion: string;
    file: string | undefined;
    selectedLines: {
        line: number;
        lineEnd?: number;
    } | null;
    diff?: {
        leftMinecraftVersion: string;
    };
}

const HARDCODED_MC_VERSION = "1.7.10";

const DEFAULT_STATE: State = {
    version: 0,
    minecraftVersion: HARDCODED_MC_VERSION,
    file: undefined,
    selectedLines: null
};

const normalizeMinecraftVersion = (version: string): string =>
    version === "25w45a" ? "25w45a_unobfuscated" : version;

const withClassExtension = (filePath: string): string =>
    filePath + (filePath.endsWith('.class') ? '' : '.class');

const looksLikeMinecraftVersion = (segment: string): boolean =>
    /^(\d|[a-z]*\d)/i.test(segment);

export const parsePathToState = (path: string): State | null => {
    let lineNumber: number | null = null;
    let lineEnd: number | null = null;
    const lineMatch = path.match(/(?:#|%23)L(\d+)(?:-(\d+))?$/);
    if (lineMatch) {
        lineNumber = parseInt(lineMatch[1], 10);
        if (lineMatch[2]) {
            lineEnd = parseInt(lineMatch[2], 10);
        }
        path = path.substring(0, lineMatch.index);
    }

    const segments = path.split('/').filter(s => s.length > 0);

    if (segments.length < 2) {
        return null;
    }

    const version = parseInt(segments[0], 10);
    const selectedLines = lineNumber ? { line: lineNumber, lineEnd: lineEnd || undefined } : null;

    if (segments[1] === "diff") {
        if (segments.length < 4) {
            return null;
        }

        const leftMinecraftVersion = normalizeMinecraftVersion(decodeURIComponent(segments[2]));
        const minecraftVersion = normalizeMinecraftVersion(decodeURIComponent(segments[3]));
        const filePath = segments.slice(4).join('/');

        return {
            version,
            minecraftVersion,
            file: filePath ? withClassExtension(filePath) : undefined,
            selectedLines,
            diff: { leftMinecraftVersion }
        };
    }

    if (segments.length === 2 && looksLikeMinecraftVersion(segments[1])) {
        return null;
    }

    const hasExplicitMinecraftVersion = segments.length >= 3 && !["net", "com", "org"].includes(segments[1]);
    if (hasExplicitMinecraftVersion) {
        const minecraftVersion = normalizeMinecraftVersion(decodeURIComponent(segments[1]));
        const filePath = segments.slice(2).join('/');

        return {
            version,
            minecraftVersion,
            file: withClassExtension(filePath),
            selectedLines
        };
    }

    const filePath = segments.slice(1).join('/');

    return {
        version,
        minecraftVersion: HARDCODED_MC_VERSION,
        file: withClassExtension(filePath),
        selectedLines
    };
};

export const getInitialState = (): State => {
    const pathname = window.location.pathname;
    const hash = window.location.hash;

    const newStyle = pathname !== '/' && pathname !== '';

    let path = newStyle
        ? pathname.slice(1)
        : (hash.startsWith('#/') ? hash.slice(2) : (hash.startsWith('#') ? hash.slice(1) : ''));

    if (newStyle && hash.startsWith('#L')) {
        path += hash;
    }

    try {
        const state = parsePathToState(path);
        if (state === null) {
            return DEFAULT_STATE;
        }

        resetPermalinkAffectingSettings();
        return state;
    } catch (e) {
        console.error("Error parsing permalink:", e);
        return DEFAULT_STATE;
    }
};

if (typeof window !== "undefined") {
    window.addEventListener('load', () => {
        combineLatest([
            selectedMinecraftVersion,
            selectedFile,
            selectedLines,
            supportsPermalinking,
        ]).subscribe(([
            ,
            file,
            selectedLines,
            supported,
        ]) => {
            if (!file) {
                document.title = "mcsrc.dev";
                window.location.hash = '';
                window.history.replaceState({}, '', '/');
                return;
            }

            const className = file.split('/').pop()?.replace('.class', '') || file;
            document.title = className;

            if (!supported) {
                window.location.hash = '';
                window.history.replaceState({}, '', '/');
                return;
            }

            let url = `/1/${file.replace(".class", "")}`;

            if (selectedLines) {
                const { line, lineEnd } = selectedLines;
                if (lineEnd && lineEnd !== line) {
                    url += `#L${Math.min(line, lineEnd)}-${Math.max(line, lineEnd)}`;
                } else {
                    url += `#L${line}`;
                }
            }

            window.history.replaceState({}, '', url);
        });
    });
}
