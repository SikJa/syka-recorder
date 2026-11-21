import { createContext } from "react";
import type { VerticalFramingMode } from "./videoPlayback/verticalFraming";

/**
 * The editor's vertical framing for the inline preview. Provided around the
 * preview panel so the playback reads the project setting without threading it
 * through every layout component.
 */
export const VerticalFramingContext = createContext<VerticalFramingMode | null>(null);
