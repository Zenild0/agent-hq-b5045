# ZenoBid on a Windows server, with your domain on Cloudflare

Result: `https://auction.yourdomain.com` for everyone, anywhere. **No ports to open, no certificates to
manage, no IIS/nginx:** the app runs as a Windows service and a **Cloudflare Tunnel** connects it to your domain
(Cloudflare provides the HTTPS and passes WebSockets through).

```
people  ──https──▶  Cloudflare  ◀──outbound tunnel──  cloudflared  ──▶  ZenoBid (127.0.0.1:8787)   [your Windows server]
```

> **Honest note:** the app itself is thoroughly tested, but I could not run Windows or Cloudflare from my side.
> The scripts in `deploy/windows/` are short and simple, but they have not been run on a real Windows machine.
> Each step says what you should see, so a problem shows up right away.

## What you need

* A Windows machine (Windows Server 2019+, or Windows 10/11) that is **on and awake** whenever you run an auction, with internet access and Administrator rights.
* Your domain on Cloudflare (you have this).
* A free Cloudflare account with **Zero Trust** enabled (Cloudflare may ask for a card on file even for the free plan; it is not charged).

## 1 · Install Node.js and Git

Open **PowerShell as Administrator** (Start → type *PowerShell* → right-click → *Run as administrator*):

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install NSSM.NSSM
```
(No `winget`? Download the installers from nodejs.org, git-scm.com and nssm.cc instead.)
**Close PowerShell and open a new Administrator PowerShell**, then check: `node -v` should print `v22…` (or 20+).

## 2 · Get the app and build it

```powershell
cd C:\
git clone -b claude/zeno-team-auction-app-bhi4m3 https://github.com/Zenild0/agent-hq-b5045.git zenobid
cd C:\zenobid\zeno-auction
npm ci
npm run build
```
You should see `built in …s` at the end. (Private repo? use a GitHub token or deploy key when cloning.)

## 3 · Run it as a Windows service

```powershell
cd C:\zenobid\zeno-auction
powershell -ExecutionPolicy Bypass -File .\deploy\windows\install-service.ps1
```
You should see **"ZenoBid is running. Health check: {"ok":true,…}"**. Your auctions and photos are stored in
`C:\zenobid-data`; logs in `C:\zenobid-data\logs`. The service starts by itself after a reboot.
Quick local test on the server: open `http://localhost:8787` in a browser.

## 4 · Connect your domain with a Cloudflare Tunnel

1. Go to **one.dash.cloudflare.com** (Cloudflare Zero Trust) → **Networks → Tunnels → Create a tunnel**.
2. Choose **Cloudflared**, name it `zenobid`, **Save tunnel**.
3. Under *Install and run connectors* choose **Windows**. Cloudflare shows a command (it includes your private token). **Copy it and run it in your Administrator PowerShell** — it installs `cloudflared` as a Windows service. The tunnel should turn **Healthy**.
4. Next → **Public hostname**: Subdomain `auction`, Domain *your domain*, Service **Type `HTTP`**, URL **`localhost:8787`** → **Save**.
   Cloudflare creates the DNS record for you — **you don't add an A record** in this setup.
5. Open **`https://auction.yourdomain.com`** — you should see ZenoBid.

## 5 · Your first auction

On `https://auction.yourdomain.com` click **Create an auction**. Use **only that address** from now on (not `localhost`):
the **Share & links** tab then produces links on your domain, ready to send.

## Keeping it healthy

| Task | How |
|---|---|
| **Update** to the newest version | `powershell -ExecutionPolicy Bypass -File C:\zenobid\zeno-auction\deploy\windows\update.ps1` (as Administrator; not mid-auction) |
| **Is it running?** | `Get-Service ZenoBid, cloudflared` (both should say *Running*) |
| **Restart the app** | `Restart-Service ZenoBid` |
| **Logs** | `Get-Content C:\zenobid-data\logs\error.log -Tail 50` |
| **Back up** everything | `powershell -ExecutionPolicy Bypass -File C:\zenobid\zeno-auction\deploy\windows\backup.ps1` → `C:\zenobid-backups\zenobid-DATE.zip` |
| **Automatic hourly backup** | `schtasks /Create /SC HOURLY /TN ZenoBidBackup /RU SYSTEM /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\zenobid\zeno-auction\deploy\windows\backup.ps1"` |
| **Restore** a backup | `Stop-Service ZenoBid` → `Expand-Archive C:\zenobid-backups\zenobid-DATE.zip -DestinationPath C:\zenobid-data -Force` → `Start-Service ZenoBid` |

**Stop the server falling asleep or rebooting mid-event:** Settings → Power → *Never* sleep when plugged in; and set Windows Update *Active hours* (or pause updates) around event times.
**Firewall:** nothing to open — the tunnel only makes *outbound* connections, and the app listens on `127.0.0.1` only.

## Event-day checklist

1. `Get-Service ZenoBid, cloudflared` → both Running; run `backup.ps1`.
2. Open the site from your **phone on mobile data** (a different network) and do a **practice run**.
3. On the computer that will share the big screen, check sound and the announcer voice.
4. Send each captain their personal link; keep the **admin link** private.

## Troubleshooting

| Symptom | Likely cause → fix |
|---|---|
| Cloudflare page **"Error 1033"** | The tunnel isn't connected: `Get-Service cloudflared`; start it, check the server's internet access. |
| **"502 Bad Gateway"** | The app isn't running: `Get-Service ZenoBid`, then read `C:\zenobid-data\logs\error.log`. |
| `install-service.ps1` says *NSSM not found* | Install it (`winget install NSSM.NSSM`) and open a **new** PowerShell window. |
| "running scripts is disabled" | Use `powershell -ExecutionPolicy Bypass -File …` exactly as shown. |
| Screens feel slow / "Connection lost" repeats | WebSockets blocked: in Cloudflare → your domain → **Network** → make sure **WebSockets** is **On** (it is by default). |
| "Too many wrong keys" for everyone | The visitor's real address isn't being passed: the service is installed with `TRUST_PROXY=true`; re-run `install-service.ps1` if you changed it. |
| Changed the port | Re-run `install-service.ps1 -Port 9000` **and** change the tunnel's URL to `localhost:9000`. |

## Good to know

* **One copy only.** Don't run the app twice against the same `C:\zenobid-data`.
* **Keep secret:** the admin link, auctioneer link and captain PINs. The big-screen link and join code are for sharing.
* If the machine ever dies, your auctions are the files in `C:\zenobid-data` — restore the latest backup on a new machine and repeat steps 1–4.
* Prefer a Linux server later? See `deploy/README.md` (Docker + Caddy).
