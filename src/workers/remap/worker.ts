import * as Comlink from "comlink";
import { RemapWorker } from "./types";

Comlink.expose(new RemapWorker());
