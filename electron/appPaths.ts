import path from "node:path";
import { app } from "electron";

if (process.env.SYKA_RECORDER_USER_DATA || process.env["VITE_DEV_SERVER_URL"]) {
	const devUserDataPath = process.env.SYKA_RECORDER_USER_DATA
		? path.resolve(process.env.SYKA_RECORDER_USER_DATA)
		: path.join(app.getPath("appData"), "Syka Recorder-dev");
	app.setPath("userData", devUserDataPath);
	app.setPath("sessionData", path.join(devUserDataPath, "session"));
}

export const USER_DATA_PATH = app.getPath("userData");
export const RECORDINGS_DIR = path.join(USER_DATA_PATH, "recordings");
