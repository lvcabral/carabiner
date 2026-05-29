# Setting Up Apple TV Control

Carabiner controls Apple TV using **pyatv** — an open-source Python library that implements Apple's Media Remote Protocol (MRP).

## Requirements

- Apple TV HD or Apple TV 4K (any generation), running tvOS 9+
- Device on the same local network

---

## 1. Install pyatv

Modern macOS (12+) blocks `pip install` into the system Python with an `externally-managed-environment` error. Use **pipx** instead — it is the recommended way to install Python CLI tools in an isolated environment.

### Install pipx (if you don't have it)

```bash
brew install pipx
pipx ensurepath
```

Or without Homebrew:

```bash
pip3 install pipx --break-system-packages
```

### Install pyatv via pipx

```bash
pipx install pyatv
which atvremote   # note this path for Carabiner
```

The binary is typically at `/Users/<you>/.local/bin/atvremote`.

**Note:** There is currently [an issue](https://github.com/postlund/pyatv/pull/2831) in `pyatv` with Python 3.14 so if you have that version, use Python 3.12  with `pipx install --python python3.12 pyatv` instead.

> **Alternative (virtual environment):** If you prefer, create a venv and install there:
> ```bash
> python3 -m venv ~/.venvs/pyatv
> ~/.venvs/pyatv/bin/pip install pyatv
> # use ~/.venvs/pyatv/bin/atvremote as your path in Carabiner
> ```

---

## 2. Pair with Your Apple TV (one-time)

Scan for devices to check available protocols and confirm connectivity:
```
atvremote scan
```

Find your Apple TV in the list and note the supported protocols (e.g. `mrp`, `AirPlay`) and one of the identifiers.

If `mrp` is supported, pair using the identifier and protocol:
```bash
atvremote --id <apple-tv-identifier> --protocol mrp pair
```

Otherwise use the identifier and the AirPlay protocol:
```bash
atvremote --id <apple-tv-identifier> --protocol airplay pair
```

A **PIN code** will appear on your Apple TV screen. Type it in the terminal when prompted. Credentials are saved automatically to `~/.pyatv/` and reused for all future sessions — no re-pairing needed.

To find your Apple TV's IP address:  
**Settings → Network → Wi-Fi → IP Address**

---

## 3. Configure Carabiner

1. Open the **Control** tab in Carabiner settings.
2. Click **…** next to **atvremote Tool Path** and select your `atvremote` binary.
3. Enter the Apple TV's IP address and select **Apple TV**.
4. Click **+** to add the device.

---

## Key Mappings

| Key | Apple TV Action |
|-----|-----------------|
| Arrow keys | Navigate |
| Enter | Select |
| Escape / Delete | Back / Menu |
| Home | Home screen |
| End | Play / Pause |
| Page Up | Volume Up |
| Page Down | Volume Down |
| Insert | Top Menu |
| Cmd/Ctrl + ← / → | Previous / Next |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `error: externally-managed-environment` | Use `pipx install pyatv` instead of `pip install` — see Step 1 above |
| `PairError` during pairing | Make sure the Apple TV is awake and on the same network |
| First key press is slow (~5 s) | Apply the Companion protocol patch below |
| `AuthenticationError` | Re-pair: `atvremote --address <ip> --protocol mrp pair` |
| `ConnectionRefused` | Confirm your Apple TV and Mac are on the same subnet |
| Keys not responding | Check the `atvremote` path is set correctly and the device is selected in the tray |

---

## Optional: Patch pyatv to Fix First-Command Delay with Companion Protocol

When sending a key, `atvremote` initialises all available protocols, if Companion is paired, the handshake (`FetchAttentionState`) times out after ~5 seconds, causing the first key press in each session to be noticeably slow. The patch below caps that timeout at 0.5 s and silences the resulting ERROR log.

### Find the file

```bash
find ~/.local/pipx/venvs/pyatv -name "__init__.py" -path "*/companion/*"
```

The path is typically:
`~/.local/pipx/venvs/pyatv/lib/python3.X/site-packages/pyatv/protocols/companion/__init__.py`

### Apply the patch

Open the file and locate the `initialize` method inside the `CompanionPower` class (search for `fetch_attention_state`). Make these two changes:

**Before:**
```python
        try:
            system_status = await self.api.fetch_attention_state()
            ...
        except Exception as ex:
            _LOGGER.exception(
                "Could not fetch SystemStatus, power_state will not work (%s)", ex
            )
```

**After:**
```python
        try:
            system_status = await asyncio.wait_for(
                self.api.fetch_attention_state(), timeout=0.5
            )
            ...
        except Exception as ex:
            _LOGGER.debug(
                "Could not fetch SystemStatus, power_state will not work (%s)", ex
            )
```

- `asyncio.wait_for(..., timeout=0.5)` — fails fast instead of waiting the full 5 s default.
- `_LOGGER.debug` — suppresses the ERROR log and traceback; only visible with `atvremote -d`.

The change takes effect immediately on the next `atvremote` invocation — no reinstall needed.

> **Note:** This patch modifies a file inside your pipx virtual environment. It will be overwritten if you upgrade pyatv with `pipx upgrade pyatv`.

---

## Further Reading

- [pyatv documentation](https://pyatv.dev/)
- [Media Remote Protocol reverse engineering](https://edc.me/posts/dissecting-the-media-remote-protocol/)
