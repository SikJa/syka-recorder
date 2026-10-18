import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { loadAppSetting, saveAppSetting } from "@/lib/appSettings";
import { RecordlySignInDialog } from "./RecordlySignInDialog";
import { Modal } from "@heroui/react";
import { OnboardingPermissions } from "./OnboardingPermissions";

const SEEN_KEY = "recordly.onboarding.v1.seen";

export function OnboardingController({
	requestNonce,
	ready,
	user,
	configured,
	callbackError,
}: {
	requestNonce: number;
	ready: boolean;
	user: User | null;
	configured: boolean;
	callbackError?: string;
}) {
	const [open, setOpen] = useState(false);
	const [startWithPermissions, setStartWithPermissions] = useState(false);
	const checked = useRef(false);
	useEffect(() => {
		if (requestNonce > 0) {
			setStartWithPermissions(true);
			setOpen(true);
		}
	}, [requestNonce]);
	const close = useCallback(() => {
		saveAppSetting("recordly.onboarding.permissionsRequested", false);
		setStartWithPermissions(false);
		setOpen(false);
	}, []);

	useEffect(() => {
		if (!ready) return;
		if (!configured) {
			if (loadAppSetting<boolean>("recordly.onboarding.permissionsRequested")) {
				setStartWithPermissions(true);
				setOpen(true);
			}
			return;
		}
		if (!user) {
			setOpen(true);
			return;
		}
		if (checked.current) return;
		checked.current = true;
		if (loadAppSetting<boolean>("recordly.onboarding.permissionsRequested")) {
			setStartWithPermissions(true);
			setOpen(true);
		} else if (!loadAppSetting<boolean>(SEEN_KEY)) setOpen(true);
	}, [ready, user, configured]);

	useEffect(
		() =>
			window.electronAPI.onRecordingPermissionsRequested?.(() => {
				setStartWithPermissions(true);
				setOpen(true);
			}),
		[],
	);

	const finish = () => {
		if (configured && !user) return;
		saveAppSetting(SEEN_KEY, true);
		close();
		void window.electronAPI.showRecordingHud();
	};

	if (!configured) return (
		<Modal isOpen={open && startWithPermissions} onOpenChange={value => { if (!value) close(); }}>
			<Modal.Backdrop><Modal.Container placement="center"><Modal.Dialog aria-label="Permisos de Syka Recorder" className="w-full max-w-[720px] p-0">
				<OnboardingPermissions onBack={close} onFinish={finish} />
				<Modal.CloseTrigger aria-label="Cerrar" />
			</Modal.Dialog></Modal.Container></Modal.Backdrop>
		</Modal>
	);
	return (
		<RecordlySignInDialog
			onboarding
			startWithPermissions={startWithPermissions}
			variant="wide"
			open={open}
			onOpenChange={(value) => {
				if (!value && user) close();
			}}
			user={user}
			configured={configured}
			callbackError={callbackError}
			onAuthenticated={finish}
		/>
	);
}
