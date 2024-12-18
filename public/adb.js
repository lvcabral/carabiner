const path = require("path");
const exec = require("child_process").exec;
const adbPath = path.join(__dirname, "platform-tools/adb");

let isADBConnected = false;

function connectADB(deviceIp) {
    try {
        exec(`${adbPath} connect ${deviceIp}`, puts);
        isADBConnected = true;
        console.log("Connected to ADB in " + deviceIp);
    } catch (error) {
        console.error("Error connecting to ADB in " + deviceIp, error);
    }
    return isADBConnected;
}

function disconnectADB() {
    try {
        exec(`${adbPath} disconnect`, puts);
        isADBConnected = false;
        console.log("Disconnected from ADB");
    } catch (error) {
        console.error("Error disconnecting from ADB", error);
    }
    return isADBConnected;
}

function sendADBKey(key) {
    if (isADBConnected && typeof key === "string") {
        exec(`${adbPath} shell input keyevent ${key}`, puts);
        console.log(key + " pressed.");
    }
}

function puts(error,stdout,stderr) {
    if (error) console.error(error);
    console.log(stdout);
}

module.exports = {
    connectADB,
    disconnectADB,
    sendADBKey,
}
