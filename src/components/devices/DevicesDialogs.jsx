/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import RenameModal from "../RenameModal";
import ChooseVideoDialog from "./ChooseVideoDialog";
import ChooseControlDialog from "./ChooseControlDialog";
import ConfirmModal from "./ConfirmModal";

// The dialogs, confirmations and toast of the Video and Control tabs. Rendered once (outside the
// tabs) so either tab can open any of them, e.g. "Choose more devices…" on a Video row.
function DevicesDialogs({ devices }) {
  const {
    entries,
    rceAccounts,
    streamingDevices,
    online,
    showVideo,
    setShowVideo,
    showControl,
    setShowControl,
    rename,
    setRename,
    confirm,
    setConfirm,
    toast,
    toastNode,
    setVideoChosen,
    handleAddAccount,
    handleRefreshAccount,
    handleRemoveAccount,
    handleAddStream,
    handleAddSimulator,
    handleTestSimulator,
    handleRemoveStream,
    handleToggleControl,
    handleSetAllControls,
    handleRemoveControl,
    onUpdateStreamingDevices,
    handleScan,
    handleRename,
  } = devices;

  return (
    <>
      <ChooseVideoDialog
        show={showVideo}
        entries={entries}
        accounts={rceAccounts}
        onHide={() => setShowVideo(false)}
        onToggle={setVideoChosen}
        onAddAccount={handleAddAccount}
        onRefreshAccount={handleRefreshAccount}
        onRemoveAccount={handleRemoveAccount}
        onAddStream={handleAddStream}
        onAddSimulator={handleAddSimulator}
        onTestSimulator={handleTestSimulator}
        onRemoveStream={handleRemoveStream}
        toast={toast}
      />
      <ChooseControlDialog
        show={showControl}
        deviceList={streamingDevices}
        online={online}
        onHide={() => setShowControl(false)}
        onToggle={handleToggleControl}
        onSetAll={handleSetAllControls}
        onRemove={handleRemoveControl}
        onDeviceListChange={onUpdateStreamingDevices}
        onScan={handleScan}
        toast={toast}
      />
      <RenameModal
        show={!!rename}
        title={rename?.kind === "control" ? "Rename Device" : "Rename Stream"}
        initialValue={rename?.name || ""}
        defaultName={rename?.defaultName || ""}
        onConfirm={handleRename}
        onHide={() => setRename(null)}
      />
      <ConfirmModal request={confirm} onHide={() => setConfirm(null)} />
      {toastNode}
    </>
  );
}

export default DevicesDialogs;
