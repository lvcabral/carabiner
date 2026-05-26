# Setting Up Apple TV Control

Carabiner controls Apple TV using **pyatv** — an open-source Python library that implements Apple's Media Remote Protocol (MRP).

## Requirements

- Python 3.9+ installed
- Apple TV HD or Apple TV 4K (any generation), running tvOS 9+
- Device on the same local network

---

## 1. Install pyatv

```bash
pip install pyatv
which atvremote   # note this path for Carabiner
```

> On macOS with Homebrew Python or a virtualenv, the path may be something like  
> `/opt/homebrew/bin/atvremote` or `/usr/local/bin/atvremote`.

---

## 2. Pair with Your Apple TV (one-time)

```bash
atvremote --address <apple-tv-ip> --protocol mrp pair
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
| `PairError` during pairing | Make sure the Apple TV is awake and on the same network |
| Commands are slow (~1–2 s) | Normal — each key press starts a new connection; this is a limitation of the `atvremote` CLI approach |
| `AuthenticationError` | Re-pair: `atvremote --address <ip> --protocol mrp pair` |
| `ConnectionRefused` | Confirm your Apple TV and Mac are on the same subnet |
| Keys not responding | Check the `atvremote` path is set correctly and the device is selected in the tray |

---

## Further Reading

- [pyatv documentation](https://pyatv.dev/)
- [Media Remote Protocol reverse engineering](https://edc.me/posts/dissecting-the-media-remote-protocol/)
