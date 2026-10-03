# Putting Children's Choir ZD online

Pick the option that matches how you want to use it.

| | Laptop must be on? | Cost | Effort | Notes |
|---|---|---|---|---|
| **A. Your laptop + Tailscale Funnel** | Yes (lid can be closed, but not shut down or asleep) | Free | Easy | Data stays on your laptop. Stops if the laptop is off. |
| **B. Render (cloud server)** | No | about $7 a month (check current price) | Easy | Works when your laptop is shut down. Recommended if a small fee is fine. |
| **C. Free cloud server (Oracle or Google "Always Free")** | No | Free (card needed to sign up) | Hard (a Linux server to manage) | Works when your laptop is shut down. Step-by-step guide: **[deploy/GOOGLE-CLOUD.md](deploy/GOOGLE-CLOUD.md)** (Google free server + your own domain through Cloudflare). |

Free hosting services that sleep or have no disk (Render's free plan, Netlify) are **not** suitable: they lose data or stop when idle.

---

## A. Free: your laptop with the lid closed, shared with Tailscale Funnel

Tailscale's Funnel gives your laptop a public https address on its free Personal plan, and hides your home IP address. The app runs on your laptop, so your data stays with you.

1. **Keep the laptop awake with the lid closed.** Control Panel → Hardware and Sound → Power Options → *Choose what closing the lid does* → **When I close the lid: Plugged in = Do nothing**. Also set *Put the computer to sleep* to **Never** when plugged in. Keep it plugged in, on Wi-Fi, and somewhere airy.
2. Install **Tailscale** from tailscale.com/download and sign in (free account).
3. In the Tailscale admin console, turn on **MagicDNS** and **HTTPS certificates** (DNS page). The first time you run Funnel it prints a link to allow Funnel for your account: open it and approve. Follow Tailscale's on-screen prompts, as their pages change.
4. Double-click **`start-choir-online.bat`**. The first time it asks you to choose a **teacher PIN** (8+ letters/digits). It saves the PIN in `choir-pin.txt` next to the app (this file is never uploaded). It then starts Funnel and the app, and prints your address, like `https://your-laptop.your-tailnet.ts.net`.
5. Open that address + `/teacher` on your phone and enter your PIN. Your phone remembers it.
6. **Settings → Website address to share with parents**: paste the address and save. Then **Children → Parent access** to share the link and codes.

Good to know:
- If the laptop is shut down, asleep, or offline, the app is unreachable.
- Windows updates can restart the laptop. Run `start-choir-online.bat` again afterwards.
- If parents get locked out together after wrong codes, tap **Unlock everyone now** in Parent access.

---

## B. Easiest always-on: Render

> Prices and button names are from memory of Render's site: check them on render.com before you pay.

This app is a small Node server that saves everything (children, photos, recordings) to a disk. Render runs it as it is, with a disk that keeps your data, and your laptop can be shut down.

### Before you start
1. On your computer, open the app → **Settings → Download backup**. Keep that `.tar` file safe.
2. Make an account at https://render.com (sign up with GitHub).

### Create the service
1. **New + → Web Service** → connect GitHub → choose the `agent-hq-b5045` repository.
2. Fill in:
   - **Branch:** `claude/childrens-choir-attendance-r3d2st`
   - **Root Directory:** `choir-attendance`
   - **Runtime:** Node
   - **Build Command:** `echo ok`
   - **Start Command:** `node server.js`
   - **Instance type:** a paid one that supports a disk (Starter)
   - **Health Check Path:** `/healthz`
3. **Environment variables:**
   | Name | Value |
   |---|---|
   | `CHOIR_PIN` | a PIN only you know (8+ letters/digits) |
   | `CHOIR_PUBLIC` | `1` |
   | `CHOIR_DATA` | `/data/db.json` |
   | `CHOIR_TRUST_PROXY` | `1` |
   | `NODE_VERSION` | `22` |
4. **Disks → Add Disk:** name `choir-data`, mount path `/data`, size `1 GB`.
5. **Create Web Service.** After a few minutes you get an address like `https://childrens-choir-zd.onrender.com`.

(A ready-made `render.yaml` is in the repository root for Render's *Blueprint* option.)

### First-time setup
1. Open `https://<your-address>/teacher` and enter your PIN.
2. **Settings → Restore from backup** and pick the `.tar` file. Your children, attendance, hymns and photos appear.
3. **Settings → Website address to share with parents**: paste your address and save.
4. **Children → Parent access:** copy the link and codes to WhatsApp.
5. On a phone: open the address, then **Add to Home screen / Install app**.

---

## C. Free cloud server (outline)
Oracle Cloud and Google Cloud both offer an "Always Free" small server that runs 24/7. You need a credit card to sign up (it is only used to verify you), and you manage a Linux server yourself. Oracle can reclaim servers that sit idle for a week unless the account is switched to Pay-As-You-Go (which stays free within the free limits). If you want this, tell me and The guide is in [deploy/GOOGLE-CLOUD.md](deploy/GOOGLE-CLOUD.md).

---

## Looking after it (any option)
- **Backups:** Settings → Download backup, now and then (for example monthly, and before big changes).
- **Privacy:** anyone who has a child's code can see that child's details, so give each parent only their own code. Keep your PIN private.
- **Updates:** run `git pull` (laptop) or push to the branch (Render redeploys).
