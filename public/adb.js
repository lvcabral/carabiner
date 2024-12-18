const path = require("path");
const exec = require("child_process").exec;
const adbPath = path.join(__dirname, "platform-tools/adb");

let isADBConnected = false;

function connectADB(deviceIp) {
    try {
        exec(adbPath + " connect " + deviceIp, puts);
        isADBConnected = true;
        console.log("Connected to ADB in " + deviceIp);
    } catch (error) {
        console.error("Error connecting to ADB in " + deviceIp, error);
    }
    return isADBConnected;
}

function disconnectADB() {
    try {
        exec(adbPath + " disconnect", puts);
        isADBConnected = false;
        console.log("Disconnected from ADB");
    } catch (error) {
        console.error("Error disconnecting from ADB", error);
    }
    return isADBConnected;
}

function sendADBKey(key) {
    if (isADBConnected && typeof key === "string") {
        if (key === "up") {
            exec(adbPath + " shell input keyevent 19", puts);
        } else if (key === "down") {
            exec(adbPath + " shell input keyevent 20", puts);
        } else if (key === "left") {
            exec(adbPath + " shell input keyevent 21", puts);
        } else if (key === "right") {
            exec(adbPath + " shell input keyevent 22", puts);
        } else if (key === "select") {
            exec(adbPath + " shell input keyevent 66", puts);
        } else if (key === "back") {
            exec(adbPath + " shell input keyevent 4", puts);
        } else if (key === "home") {
            exec(adbPath + " shell input keyevent 3", puts);
        } else if (key === "info") {
            exec(adbPath + " shell input keyevent 1", puts);
        } else if (key === "rev") {
            exec(adbPath + " shell input keyevent 89", puts);
        } else if (key === "play") {
            exec(adbPath + " shell input keyevent 85", puts);
        } else if (key === "fwd") {
            exec(adbPath + " shell input keyevent 90", puts);
        } else if (key === "volumemute") {
            exec(adbPath + " shell input keyevent 164", puts);
        }
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
