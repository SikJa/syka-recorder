import {
	ArrowClockwiseIcon,
	House,
	DotsSixVerticalIcon,
	HandGrabbingIcon,
	MicrophoneIcon,
	MicrophoneSlashIcon,
	MinusIcon,
	MonitorIcon,
	RecordIcon,
	TimerIcon,
	VideoCameraIcon,
	VideoCameraSlashIcon,
	XIcon,
} from "@/components/ui/icons";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { useScopedT } from "../../contexts/I18nContext";
import { useMicrophoneDevices } from "../../hooks/useMicrophoneDevices";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { useVideoDevices } from "../../hooks/useVideoDevices";
import { Button } from "../ui/button";
import { HudInteractionContext } from "./contexts/HudInteractionContext";
import {
	canToggleFloatingWebcamPreview,
	WEBCAM_PREVIEW_RESIZE_HANDLES,
} from "./floatingWebcamPreview";
import { useHudBarDrag } from "./hooks/useHudBarDrag";
import { useHudInputShape } from "./hooks/useHudInputShape";
import { useLaunchHudInteractionState } from "./hooks/useLaunchHudInteractionState";
import { useLaunchWindowActions } from "./hooks/useLaunchWindowActions";
import { useLaunchWindowSystemState } from "./hooks/useLaunchWindowSystemState";
import { useRecordingTimer } from "./hooks/useRecordingTimer";
import { useWebcamPreviewOverlay } from "./hooks/useWebcamPreviewOverlay";
import styles from "./LaunchWindow.module.css";
import "./hudMotion.css";
import { MarqueeText } from "./MarqueeText";
import { CountdownPopover } from "./popovers/CountdownPopover";
import {
	LaunchPopoverCoordinatorProvider,
	useLaunchPopoverCoordinator,
} from "./popovers/LaunchPopoverCoordinator";
import { MicPopover } from "./popovers/MicPopover";
import { toast } from "@/components/ui/toast";
import { WebcamPopover } from "./popovers/WebcamPopover";
import { RecordingControls } from "./RecordingControls";
import { CornersOut, PencilSimple } from '@phosphor-icons/react';
import { DrawingInput, DrawingTools, DRAWING_TOOLS } from './drawing/DrawingTools';
import { useRecordingDrawing } from './drawing/useRecordingDrawing';

export function LaunchWindow() {
	return (
		<LaunchPopoverCoordinatorProvider>
			<LaunchWindowContent />
		</LaunchPopoverCoordinatorProvider>
	);
}

function LaunchWindowContent() {
	const t = useScopedT("launch");
	const { openId } = useLaunchPopoverCoordinator();

	const {
		recording,
		paused,
		finalizing,
		countdownActive,
		toggleRecording,
		pauseRecording,
		resumeRecording,
		cancelRecording,
		cancelRecordingStart,
		microphoneEnabled,
		setMicrophoneEnabled,
		microphoneDeviceId,
		setMicrophoneDeviceId,
		systemAudioEnabled,
		setSystemAudioEnabled,
		webcamEnabled,
		setWebcamEnabled,
		webcamDeviceId,
		setWebcamDeviceId,
		countdownDelay,
		setCountdownDelay,
		preparePermissions,
	} = useScreenRecorder();

	const { elapsed, formatTime } = useRecordingTimer(recording, paused);
  const drawing = useRecordingDrawing(recording);
	const hudContentRef = useRef<HTMLDivElement>(null);
	const hudBarRef = useRef<HTMLDivElement>(null);

	const { selectedSource, hasSelectedSource, syncSelectedSource } = useLaunchWindowActions();

	const showWebcamControls = webcamEnabled && !recording;
	const { devices, selectedDeviceId, setSelectedDeviceId } = useMicrophoneDevices(
		microphoneEnabled || openId === "mic",
		microphoneDeviceId,
	);
	const {
		devices: videoDevices,
		selectedDeviceId: selectedVideoDeviceId,
		setSelectedDeviceId: setSelectedVideoDeviceId,
	} = useVideoDevices(webcamEnabled || openId === "webcam");

	const { hudOverlayMousePassthroughSupported, platform } =
		useLaunchWindowSystemState(preparePermissions);
	useHudInputShape(platform);

	useEffect(() => {
		if (!selectedDeviceId) {
			return;
		}

		setMicrophoneDeviceId(selectedDeviceId === "default" ? undefined : selectedDeviceId);
	}, [selectedDeviceId, setMicrophoneDeviceId]);

	useEffect(() => {
		if (selectedVideoDeviceId && selectedVideoDeviceId !== "default") {
			setWebcamDeviceId(selectedVideoDeviceId);
		}
	}, [selectedVideoDeviceId, setWebcamDeviceId]);

	const {
		showFloatingWebcamPreview,
		setShowFloatingWebcamPreview,
		showRecordingWebcamPreview,
		webcamPreviewOffset,
		webcamPreviewSize,
		recordingWebcamPreviewContainerRef,
		isWebcamPreviewDraggingRef,
		webcamPreviewDragStartRef,
		handleWebcamPreviewPointerDown,
		handleWebcamPreviewPointerMove,
		handleWebcamPreviewPointerUp,
		handleWebcamPreviewResizePointerDown,
		handleWebcamPreviewResizePointerMove,
		handleWebcamPreviewResizePointerUp,
		setWebcamPreviewNode,
		setRecordingWebcamPreviewNode,
	} = useWebcamPreviewOverlay({
		webcamEnabled,
		webcamDeviceId,
		showWebcamControls,
		webcamPopoverOpen: openId === "webcam",
		hudOverlayMousePassthroughSupported,
	});

	useEffect(() => {
		window.electronAPI?.hudOverlaySetWebcamPreviewVisible?.(showRecordingWebcamPreview);
	}, [showRecordingWebcamPreview]);

	useEffect(() => {
		return () => {
			window.electronAPI?.hudOverlaySetWebcamPreviewVisible?.(false);
		};
	}, []);

	const {
		recordingHudOffset,
		isHudDragging,
		hudBarTransformRef,
		isHudDraggingRef,
		handleHudBarPointerDown,
		handleHudBarPointerMove,
		handleHudBarPointerUp,
		handleHudBarLostPointerCapture,
		handleHudBarKeyDown,
	} = useHudBarDrag({
		hudContentRef,
		hudBarRef,
		recordingWebcamPreviewContainerRef,
	});

	const { handleHudMouseEnter, handleHudMouseLeave, beginInteractiveHudAction } =
		useLaunchHudInteractionState({
			openId,
			isHudDraggingRef,
			isWebcamPreviewDraggingRef,
			webcamPreviewDragStartRef,
		});

	const hudStateTransition = {
		duration: 0.24,
		ease: [0.22, 1, 0.36, 1] as const,
	};

	const pickerPending = useRef(false);
	const [isPickerPending, setIsPickerPending] = useState(false);
	const [sourceReady, setSourceReady] = useState(false);
	const handlePickOnScreen = useCallback(async () => {
		if (pickerPending.current || recording || finalizing) return;
		pickerPending.current = true;
		setIsPickerPending(true);
		beginInteractiveHudAction();
		try {
			if (!(await cancelRecordingStart())) return;
			if (!(await preparePermissions())) return;
			const result = await window.electronAPI.pickCaptureTarget();
			if (result.success && result.source) syncSelectedSource(result.source);
			if (result.message && !result.canceled) {
				if (result.success) toast.info(result.message);
				else toast.error(result.message);
			}
		} catch {
			toast.error("Unable to open the source picker.");
		} finally {
			pickerPending.current = false;
			setIsPickerPending(false);
		}
	}, [
		recording,
		cancelRecordingStart,
		preparePermissions,
		finalizing,
		beginInteractiveHudAction,
		syncSelectedSource,
	]);

	useEffect(() => {
		let mounted = true;
		let selectionEventSeen = false;

		void window.electronAPI
			.getSelectedSource()
			.then((source) => {
				if (mounted) setSourceReady(true);
				if (mounted && !selectionEventSeen) {
					syncSelectedSource(source);
				}
			})
			.catch(() => {
				if (mounted) {
					setSourceReady(true);
					toast.error("Unable to load the recording source. Pick a screen again.");
				}
			});

		const cleanup = window.electronAPI.onSelectedSourceChanged((source) => {
			selectionEventSeen = true;
			if (mounted) syncSelectedSource(source);
		});

		return () => {
			mounted = false;
			cleanup?.();
		};
	}, [syncSelectedSource]);

	const openHome = () => {
		localStorage.setItem("recordly.open-dashboard", String(Date.now()));
		void window.electronAPI.showProjectDashboard();
	};
	const homeButton = (
		<Button
			variant="ghost"
			size="icon"
			iconSize="lg"
			className={styles.compactAction}
			aria-label={t("recording.home")}
			title={t("recording.home")}
			onClick={openHome}
		>
			<House weight="fill" className="size-5" />
		</Button>
	);

	const recordingControls = drawing.compact ? (
    <Button variant="ghost" size="icon" className={styles.compactAction} title="Restaurar controles" aria-label="Restaurar controles" onClick={drawing.minimize}><CornersOut size={16}/></Button>
  ) : (
		<RecordingControls
      drawingButton={platform === 'win32' ? <Button variant="ghost" size="icon" className={`${styles.compactAction} ${drawing.active ? 'text-accent bg-accent-soft' : ''}`} title={drawing.active ? `${DRAWING_TOOLS[drawing.tool].label} activo · Esc: mouse` : 'Dibujar en pantalla (P)'} aria-label="Herramientas de dibujo" aria-expanded={drawing.panel} onClick={()=>void drawing.togglePanel()}><PencilSimple size={16}/></Button> : undefined}
			onHome={openHome}
			paused={paused}
			microphoneEnabled={microphoneEnabled}
			elapsed={elapsed}
			onPauseResume={paused ? resumeRecording : pauseRecording}
			onStopRecording={toggleRecording}
			onHideHud={drawing.minimize}
			onCancelRecording={cancelRecording}
			formatTime={formatTime}
		/>
	);

	const idleControls = (
		<>
			<Button
				variant="ghost"
				size="lg"
				className={`${styles.electronNoDrag} ${styles.sourceAction} group gap-2 min-w-0 shrink-0`}
				title={selectedSource}
				aria-label="Choose recording source"
				disabled={isPickerPending || !sourceReady || recording || finalizing}
				onClick={() => void handlePickOnScreen()}
			>
				<MonitorIcon size={18} className="size-[18px] shrink-0" />
				<div className="flex-1 min-w-0 overflow-hidden">
					{isPickerPending ? (
						<span>{t("sourceSelector.loadingSources")}</span>
					) : hasSelectedSource ? (
						<MarqueeText text={selectedSource} />
					) : (
						<span>{t("recording.screen")}</span>
					)}
				</div>
			</Button>
			<Separator orientation="vertical" className="mx-1 h-4 self-center" />

			<MicPopover
				disabled={recording}
				systemAudioEnabled={systemAudioEnabled}
				onToggleSystemAudio={() => setSystemAudioEnabled(!systemAudioEnabled)}
				microphoneEnabled={microphoneEnabled}
				onDisableMicrophone={() => setMicrophoneEnabled(false)}
				devices={devices}
				microphoneDeviceId={microphoneDeviceId}
				selectedDeviceId={selectedDeviceId}
				onSelectDevice={(deviceId) => {
					setMicrophoneEnabled(true);
					setSelectedDeviceId(deviceId);
					setMicrophoneDeviceId(deviceId === "default" ? undefined : deviceId);
				}}
				trigger={
					<Button
						variant="ghost"
						size="icon"
						iconSize="lg"
						title={
							microphoneEnabled
								? t("recording.disableMicrophone")
								: t("recording.enableMicrophone")
						}
						className={`${styles.compactAction} ${microphoneEnabled ? "text-accent" : ""}`}
					>
						{microphoneEnabled ? (
							<MicrophoneIcon
								weight={microphoneEnabled ? "fill" : "regular"}
								className="size-5"
								size={18}
							/>
						) : (
							<MicrophoneSlashIcon className="size-5" />
						)}
					</Button>
				}
			/>

			<WebcamPopover
				disabled={recording}
				webcamEnabled={webcamEnabled}
				onDisableWebcam={() => setWebcamEnabled(false)}
				canToggleFloatingPreview={canToggleFloatingWebcamPreview(
					hudOverlayMousePassthroughSupported,
				)}
				showFloatingWebcamPreview={showFloatingWebcamPreview}
				onToggleFloatingPreview={() => setShowFloatingWebcamPreview((current) => !current)}
				showWebcamControls={showWebcamControls}
				setWebcamPreviewNode={setWebcamPreviewNode}
				videoDevices={videoDevices}
				webcamDeviceId={webcamDeviceId}
				selectedVideoDeviceId={selectedVideoDeviceId}
				onSelectVideoDevice={(deviceId) => {
					setWebcamEnabled(true);
					setSelectedVideoDeviceId(deviceId);
					setWebcamDeviceId(deviceId);
				}}
				trigger={
					<Button
						variant="ghost"
						size="icon"
						iconSize="lg"
						title={
							webcamEnabled
								? t("recording.disableWebcam")
								: t("recording.enableWebcam")
						}
						className={`${styles.compactAction} ${webcamEnabled ? "text-accent" : ""}`}
					>
						{webcamEnabled ? (
							<VideoCameraIcon
								weight={webcamEnabled ? "fill" : "regular"}
								className="size-5"
								size={18}
							/>
						) : (
							<VideoCameraSlashIcon className="size-5" />
						)}
					</Button>
				}
			/>

			<CountdownPopover
				countdownDelay={countdownDelay}
				onSelectDelay={setCountdownDelay}
				trigger={
					<Button
						variant="ghost"
						size="icon"
						iconSize="lg"
						title={t("recording.countdownDelay")}
						className={`${styles.compactAction} ${countdownDelay > 0 ? "text-accent" : ""}`}
					>
						<TimerIcon
							weight={openId === "countdown" ? "fill" : "regular"}
							className="size-5"
						/>
					</Button>
				}
			/>

			<Button
				type="button"
				variant="default"
				size="icon"
				className={`${styles.electronNoDrag} ${styles.compactAction} ${styles.recordAction}`}
				onClick={hasSelectedSource ? toggleRecording : () => void handlePickOnScreen()}
				disabled={countdownActive || isPickerPending || !sourceReady}
				title={t("recording.record")}
			>
				<RecordIcon className="size-5" />
			</Button>

			<Separator orientation="vertical" className="mx-1 h-4 self-center" />

			{homeButton}

			<Button
				variant="ghost"
				size="icon"
				iconSize="lg"
				onClick={() => window.electronAPI?.hudOverlayHide?.()}
				className={styles.compactAction}
				title={t("recording.hideHud")}
			>
				<MinusIcon className="size-5" />
			</Button>

			<Button
				variant="ghost"
				size="icon"
				iconSize="lg"
				onClick={() => window.electronAPI?.hudOverlayClose?.()}
				className={styles.compactAction}
				title={t("recording.closeApp")}
			>
				<XIcon className="size-5" />
			</Button>
		</>
	);

	const finalizingControls = (
		<div className={styles.finalizingState}>
			<ArrowClockwiseIcon size={15} className={styles.finalizingSpin} />
			<div className={styles.finalizingCopy}>
				<span>{t("recording.preparing", "Preparing recording")}</span>
				<small>{t("recording.preparingSubtitle", "Opening the editor in a moment")}</small>
			</div>
		</div>
	);

	const hudMode = finalizing ? "finalizing" : recording ? "recording" : "idle";
	const useNativeHudBarDrag =
		platform === "linux" || hudOverlayMousePassthroughSupported === false;
	const shouldAnimateHudLayout = !recording && !showRecordingWebcamPreview && !isHudDragging;

	return (
		<HudInteractionContext.Provider
			value={{ onMouseEnter: handleHudMouseEnter, onMouseLeave: handleHudMouseLeave }}
		>
      {recording && <DrawingInput drawing={drawing}/>}
      {recording && <DrawingTools drawing={drawing} anchor={hudBarRef}/>}
			<div
				className="w-full flex justify-center bg-transparent overflow-visible items-end pb-5 pointer-events-none"
				style={{ height: "100vh", position: 'relative', zIndex: 2 }}
			>
				<div
					ref={hudContentRef}
					className="flex items-center overflow-visible flex-col-reverse pointer-events-none"
				>
					<div className="flex flex-col items-center pointer-events-none p-2">
						<div
							ref={hudBarTransformRef}
							style={{
								transform: `translate3d(${recordingHudOffset.x}px, ${recordingHudOffset.y}px, 0)`,
							}}
						>
							<motion.div
								ref={hudBarRef}
								data-hud-interactive
								data-dragging={isHudDragging}
								layout={shouldAnimateHudLayout}
								transition={hudStateTransition}
								className={`${styles.bar} launch-theme mb-2 pointer-events-auto`}
								onMouseEnter={handleHudMouseEnter}
								onMouseLeave={handleHudMouseLeave}
							>
								<button
									// Linux compositors and non-passthrough Windows fallback windows
									// need native window dragging; the JS drag path only translates
									// content inside the HUD window.
									type="button"
									aria-label="Mover controles"
									title="Arrastrá para mover · Flechas para ajustar"
									data-hud-drag-handle
									className={`${styles.dragHandle} ${
										useNativeHudBarDrag ? styles.electronDrag : ""
									}`}
									onPointerDown={useNativeHudBarDrag ? undefined : handleHudBarPointerDown}
									onPointerMove={useNativeHudBarDrag ? undefined : handleHudBarPointerMove}
									onPointerUp={useNativeHudBarDrag ? undefined : handleHudBarPointerUp}
									onPointerCancel={useNativeHudBarDrag ? undefined : handleHudBarLostPointerCapture}
									onLostPointerCapture={handleHudBarLostPointerCapture}
									onKeyDown={useNativeHudBarDrag ? undefined : handleHudBarKeyDown}
								>
									<span className="t-icon-swap" data-state={isHudDragging ? "b" : "a"} aria-hidden="true">
										<span className="t-icon" data-icon="a"><DotsSixVerticalIcon weight="bold" size={18} /></span>
										<span className="t-icon" data-icon="b"><HandGrabbingIcon size={18} /></span>
									</span>
								</button>

								<div className={styles.barStateViewport}>
									<AnimatePresence initial={false} mode="wait">
										<motion.div
											key={hudMode}
											layout={shouldAnimateHudLayout}
											className={styles.barState}
											initial={{
												opacity: 0,
												y: 10,
												scale: 0.985,
												filter: "blur(8px)",
											}}
											animate={{
												opacity: 1,
												y: 0,
												scale: 1,
												filter: "blur(0px)",
											}}
											exit={{
												opacity: 0,
												y: -10,
												scale: 0.985,
												filter: "blur(6px)",
											}}
											transition={hudStateTransition}
										>
											{finalizing
												? finalizingControls
												: recording
													? recordingControls
													: idleControls}
										</motion.div>
									</AnimatePresence>
								</div>
							</motion.div>
						</div>
						{showRecordingWebcamPreview && (
							<div
								ref={recordingWebcamPreviewContainerRef}
								className={`${styles.recordingWebcamPreview} ${styles.electronNoDrag} pointer-events-auto`}
								data-hud-interactive
								data-hud-drag-handle
								data-recording-webcam-preview
								title={t("recording.webcam")}
								style={{
									transform: `translate(${webcamPreviewOffset.x}px, ${webcamPreviewOffset.y}px)`,
									width: webcamPreviewSize.width,
									height: webcamPreviewSize.height,
								}}
								onMouseEnter={handleHudMouseEnter}
								onMouseLeave={handleHudMouseLeave}
								onPointerDown={handleWebcamPreviewPointerDown}
								onPointerMove={handleWebcamPreviewPointerMove}
								onPointerUp={handleWebcamPreviewPointerUp}
								onPointerCancel={handleWebcamPreviewPointerUp}
							>
								<video
									ref={setRecordingWebcamPreviewNode}
									className={styles.recordingWebcamPreviewVideo}
									muted
									playsInline
									style={{ transform: "scaleX(-1)" }}
								/>
								{WEBCAM_PREVIEW_RESIZE_HANDLES.map((handle) => (
									<div
										key={handle}
										data-resize-handle={handle}
										className={styles.recordingWebcamPreviewResizeHandle}
										onPointerDown={handleWebcamPreviewResizePointerDown}
										onPointerMove={handleWebcamPreviewResizePointerMove}
										onPointerUp={handleWebcamPreviewResizePointerUp}
										onPointerCancel={handleWebcamPreviewResizePointerUp}
									/>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</HudInteractionContext.Provider>
	);
}
