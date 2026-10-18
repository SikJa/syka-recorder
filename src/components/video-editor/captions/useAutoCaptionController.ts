import { type Dispatch, type SetStateAction, useCallback } from "react";
import { toast } from "@/components/ui/toast";
import { type CaptionEditTarget, updateCaptionCuesForEditedTarget } from "../captionEditing";
import type { AutoCaptionSettings, CaptionCue } from "../types";

type DownloadStatus = "idle" | "downloading" | "downloaded" | "error";
type Translator = (
	key: string,
	fallback?: string,
	params?: Record<string, string | number>,
) => string;

interface UseAutoCaptionControllerParams {
	t: Translator;
	videoPath: string | null;
	setVideoPath: Dispatch<SetStateAction<string | null>>;
	videoSourcePath: string | null;
	setVideoSourcePath: Dispatch<SetStateAction<string | null>>;
	webcamSourcePath: string | null;
	whisperExecutablePath: string | null;
	setWhisperExecutablePath: Dispatch<SetStateAction<string | null>>;
	whisperModelPath: string | null;
	setWhisperModelPath: Dispatch<SetStateAction<string | null>>;
	downloadedWhisperModelPath: string | null;
	setDownloadedWhisperModelPath: Dispatch<SetStateAction<string | null>>;
	whisperModelDownloadStatus: DownloadStatus;
	setWhisperModelDownloadStatus: Dispatch<SetStateAction<DownloadStatus>>;
	setWhisperModelDownloadProgress: Dispatch<SetStateAction<number>>;
	isGeneratingCaptions: boolean;
	setIsGeneratingCaptions: Dispatch<SetStateAction<boolean>>;
	autoCaptionSettings: AutoCaptionSettings;
	setAutoCaptionSettings: Dispatch<SetStateAction<AutoCaptionSettings>>;
	setAutoCaptions: Dispatch<SetStateAction<CaptionCue[]>>;
	syncActiveVideoSource: (sourcePath: string, webcamPath?: string | null) => Promise<void>;
}

// Legacy project editing only. Syka Recorder does not load or run Whisper.
export function useAutoCaptionController({ t, setAutoCaptions }: UseAutoCaptionControllerParams) {
	const handleSaveAutoCaptionEdit = useCallback(
		(target: CaptionEditTarget, text: string) => {
			setAutoCaptions((captions) => updateCaptionCuesForEditedTarget(captions, target, text));
			toast.success(t("settings.captions.editSaved", "Caption updated"));
		},
		[setAutoCaptions, t],
	);

	return { handleSaveAutoCaptionEdit };
}
