# ZenoBid on your Google Cloud server — a step-by-step guide (with a mini coding dictionary)

**Goal:** `https://teamauction.zenildodias.com` opens ZenoBid on any phone or laptop, while your choir app keeps running untouched next to it.
**Time:** about 30 minutes. **Extra cost:** nothing (see "Staying free").

> Claude wrote and **rehearsed** the scripts on a practice copy (fake GitHub, fake service manager). The Google and Cloudflare screens could not be tested, and their buttons get renamed now and then. If a screen does not match this guide, **stop and send a screenshot** — but first hide any long code or token on it.

---

## The big picture

```
 phone / laptop ──► Cloudflare (zenildodias.com) ──► secret tunnel ──► your Google server
                                                                         ├─ choir app    (door 3000)  ← not touched
                                                                         └─ ZenoBid      (door 3001)  ← new
```

Nobody can reach your server directly: there are no open doors. Only the tunnel connects.

## Rules we keep

- **The choir app is never touched:** `/opt/choir`, `/var/lib/choir`, `/etc/choir.env`, the `choir` service and port 3000 are not used or changed.
- **No secrets in chat or on GitHub.** ZenoBid has no server-wide password. Each auction makes its own secret *admin link* when you create it. The only file on the server, `/etc/zenobid.env`, holds plain settings.
- **Free:** one small server, standard disk, and well under Google's free internet allowance.

---

## Your first mini-dictionary

You will meet these words again and again. Don't memorise them, just skim:

| Word | Plain meaning |
|---|---|
| **Server** | A computer that is always on, somewhere else, that other computers visit. Yours lives in Google's building in South Carolina. |
| **Terminal / command line** | A window where you *type* instructions instead of clicking. |
| **Command** | One instruction you type and run with Enter, like `ls` (list files). |
| **SSH** | A secure way to open a terminal *on another computer*. Google gives you an **SSH button** that does it in the browser. |
| **`sudo`** | "Do this as the boss (administrator)". Needed to install things. Use it only when a step says so. |
| **Script** | A text file full of commands that runs them one after another, like a recipe. |
| **Port** | A numbered door on a computer. One program listens at each door. Choir uses door 3000, ZenoBid uses 3001. |
| **localhost / 127.0.0.1** | "This very computer". `localhost:3001` means "door 3001 on myself". |

---

## Part 1 — Open the server's terminal

1. Go to **console.cloud.google.com** and pick your project.
2. Menu → **Compute Engine → VM instances**. You'll see `choir-server`.
3. Click the **SSH** button on that row. A black window opens (click **Authorize** if asked). This is the **terminal on your server**. Every command in this guide goes in there.

🧠 **Word: VM (virtual machine).** Your server isn't a whole physical computer; it's a slice of one, rented from Google. Yours is the smallest slice (`e2-micro`: 1 GB of memory), which is why we keep ZenoBid light.

To paste in that window: **Ctrl+Shift+V** (or right-click → Paste).

## Part 2 — Check the server has room (before installing anything)

Type this and press Enter:

```
free -h
```

Look at the **Mem** line, **available** column. You want at least 250 MB. The **Swap** line should show about 1 GB — that is your emergency cushion and it will be **reused** (we do not add more).

```
df -h /
```

Look at **Avail**. You want at least 1.5 GB free (ZenoBid needs under 100 MB).

🧠 **Words: RAM, swap, disk.** *RAM* is the computer's short-term memory (fast, small). *Swap* is a slice of disk used as emergency extra RAM (slow, big). *Disk* is long-term storage, where files live.

Now download the checking script and run it. It **only looks**, it changes nothing:

```
curl -fsSL https://raw.githubusercontent.com/Zenild0/agent-hq-b5045/deploy-zenobid/deploy/google-cloud/preflight.sh -o preflight.sh
```
```
bash preflight.sh
```

You want the last line to say **OK to install**. A `!` is just a note; a `✗` means stop and tell Claude.

🧠 **Word: `curl`.** A command that downloads something from the internet. `-o preflight.sh` means "save it under this name".

## Part 3 — Install ZenoBid

```
curl -fsSL https://raw.githubusercontent.com/Zenild0/agent-hq-b5045/deploy-zenobid/deploy/google-cloud/setup.sh -o setup.sh
```
```
sudo bash setup.sh
```

It will ask one thing: the web address. Press **Enter** to accept `teamauction.zenildodias.com` (or type your own, e.g. `bid.zenildodias.com`). That is **not a secret**.

It then: checks the server again → reuses the swap → downloads the finished ZenoBid → installs its small libraries → creates its own user, folders and service → starts it. It ends with **SUCCESS: ZenoBid is running**.

🧠 **What just happened, in words:**
- **GitHub / repository (repo) / branch:** GitHub stores code. A *repo* is one project's folder there. A *branch* is one version line inside it. The server downloads a branch called `deploy-zenobid` that contains only the *finished* app.
- **Build:** turning the code you can read into the compact files a browser and a server run. Building needs lots of memory, so it is done *before* and the server just downloads the result.
- **Node.js / npm:** Node runs JavaScript on a server. `npm` installs the libraries (ready-made code) the app uses. We install only the two it needs to run.
- **Service (systemd):** a program kept running in the background. **systemd** is the manager that starts it at boot and restarts it if it crashes. Yours is called `zenobid`.
- **User:** every program runs as someone. ZenoBid runs as its own plain user `zenobid` that can only write to its own data folder. If it were ever broken into, it couldn't reach the choir app.
- **Environment variables / settings file:** values a program reads when it starts. Yours live in `/etc/zenobid.env`: the port (3001), "only listen on this computer" (`HOST=127.0.0.1`), the data folder, and `AUTO_DELETE_DAYS=30`.
- **Timer:** systemd's alarm clock. One checks GitHub every 10 minutes for a new version; one makes a backup every night at 03:10.

## Part 4 — Check it is alive (on the server)

```
curl http://127.0.0.1:3001/healthz
```

You should see something like `{"ok":true,"auctions":0,"live":0,"version":"abc1234 2026-11-01"}`.

```
sudo systemctl status zenobid
```

Look for **active (running)** in green. Press `q` to leave.

Your choir app should be completely unaffected:

```
sudo systemctl status choir
```

🧠 **Word: health check.** A tiny "are you OK?" web address (`/healthz`) that a program answers. Updates use it to decide whether the new version works.

## Part 5 — Tell Cloudflare (the public address)

Your existing tunnel `choir-server` is already connected to the server, so we only add *one more door* to it.

1. Cloudflare → **Zero Trust** (left menu).
2. **Networks → Tunnels →** click **choir-server**.
3. Open **Public hostname** → **Add a public hostname**.
4. Fill in:
   - **Subdomain:** `teamauction`
   - **Domain:** `zenildodias.com`
   - **Type:** `HTTP`
   - **URL:** `localhost:3001`
5. **Save.**

If the screen looks different (Cloudflare renames things), send a screenshot — and cover any long token first.

🧠 **Words:**
- **DNS:** the internet's phone book that turns `teamauction.zenildodias.com` into "go to Cloudflare". Cloudflare adds the entry for you.
- **Subdomain:** the first part (`teamauction`) — a separate address under your domain.
- **Tunnel:** a private pipe from your server *out* to Cloudflare, so nobody needs to knock on your server's door.
- **Reverse proxy:** Cloudflare standing in front of your app and passing visitors through.
- **HTTP vs HTTPS:** between your server and Cloudflare it is plain `HTTP` (inside the private pipe). Visitors still get a padlocked **HTTPS** connection from Cloudflare.
- **WebSocket:** the always-open line that makes bids appear instantly. Cloudflare supports it by default (Cloudflare → your domain → Network → WebSockets: **On**).

## Part 6 — Run your first auction

1. Open **https://teamauction.zenildodias.com** on your computer and click **New auction**.
2. Set it up, add teams and players, and use **Share & links** to send links to captains and the auctioneer.
3. **Keep the admin link private** (it contains `?k=...`). It is how you control the auction. If you lose it: in the server terminal, run `sudo zenobid-links` to list every auction and its links.
4. Practise first: the **Practice run** feature lets everyone try a mock auction that does not touch the real one.

## Part 7 — When the auction is over (keeping the server tidy)

Pick what you want:

- **Keep a copy on your computer, then delete from the server** *(recommended)*: Admin → **Settings → Download the whole auction file**, then **Delete this auction**. The file holds teams, players, results, history and photos. Later you can bring it back with **New auction → Restore from file**.
- **Do nothing:** auctions with no activity for 30 days delete themselves.
- **You won't use ZenoBid again:** on the server run `sudo zenobid-remove` (removes the app, keeps your auction data) or `sudo zenobid-remove --all` (removes everything, asks you to type YES). Then delete the hostname in Cloudflare. The choir app is not affected.

---

## Updates, backups and safety nets

- **Updates:** when Claude publishes a new version to the `deploy-zenobid` branch, your server downloads it within 10 minutes and restarts ZenoBid for a few seconds. **It never updates while an auction is live.** If the new version doesn't start, it **rolls back** to the previous one automatically and remembers the bad one. Update right now: `sudo zenobid-update`.
- **Backups:** every night a backup is saved in `/var/backups/zenobid` (only the administrator can read it) and the last **7 days** are kept. Run one now: `sudo zenobid-backup`. These live on the same server, so also use **Download the whole auction file** for anything important.
- **Restore a backup:** `sudo systemctl stop zenobid`, then `sudo tar -xzf /var/backups/zenobid/zenobid-YYYY-MM-DD.tgz -C /var/lib/zenobid` (use the real date), then `sudo chown -R zenobid:zenobid /var/lib/zenobid` and `sudo systemctl start zenobid`.
- **Look around:**
  ```
  sudo journalctl -u zenobid -n 40 --no-pager          # the app's messages
  sudo journalctl -u zenobid-update -n 20 --no-pager   # update history
  sudo zenobid-links                                   # all auctions and their links
  ```
- **Memory guard:** ZenoBid is capped at 300 MB. If the server ever runs short of memory, ZenoBid is stopped *before* the choir app.

## Staying free

Google's free server includes about **1 GB of data out per month**. ZenoBid sends only what changed with each bid. A measured full auction (40 players, 30 screens watching) used about **24 MB**, so roughly 40 such auctions fit in a month. Don't add a reserved IP, a bigger disk or more servers. If Google's budget alert emails you, tell Claude.

## If something goes wrong

| What you see | Try |
|---|---|
| `preflight.sh` says ✗ about the port | Something else uses 3001. Run `sudo PORT=3002 bash setup.sh` and use `localhost:3002` in Cloudflare. |
| Site says **Error 1033** or **502** | The tunnel or the app is down. `sudo systemctl status zenobid` and `sudo systemctl status cloudflared`; then `sudo systemctl restart zenobid`. |
| Page loads but bids don't update live | Cloudflare → Network → **WebSockets** must be **On**. |
| "Too many wrong keys" | Wait a minute — too many wrong PINs came from one connection. |
| An auction vanished | It was deleted by hand or by the 30-day cleanup. Restore from your downloaded file or a nightly backup. |
| Anything else | Send Claude the output of `sudo journalctl -u zenobid -n 40 --no-pager` (it contains no passwords). |

---

## Dictionary (A–Z)

**Backup** – a spare copy of your data. **Branch** – one version line of a repo. **Build** – turning source code into runnable files. **Command** – one typed instruction. **Commit** – a saved snapshot of changes in git. **Cron/timer** – a scheduled job. **DNS** – the internet's phone book. **Environment variable** – a setting a program reads on start. **git** – the tool that tracks versions of code. **GitHub** – a website that stores git repos. **Health check** – a tiny "are you OK?" page. **HTTP/HTTPS** – the language of web pages / its padlocked version. **JSON** – a simple text format for data; auction files are JSON. **localhost** – this very computer. **Node.js** – runs JavaScript on servers. **npm** – installs libraries for Node. **Port** – a numbered door on a computer. **Pull/fetch** – download new changes. **Push** – upload your changes. **Repo** – a project's folder on GitHub. **Reverse proxy** – a front desk passing visitors to the right app. **Rollback** – going back to the last working version. **Script** – a file of commands. **Server** – an always-on computer others visit. **Service** – a program kept running by the system. **SSH** – secure remote terminal. **Subdomain** – the front part of an address (`auction.`). **`sudo`** – run as administrator. **Swap** – disk used as emergency memory. **systemd** – the manager of services and timers on Linux. **Terminal** – the window where you type commands. **Tunnel** – a private pipe to Cloudflare. **VM** – a rented slice of a computer. **WebSocket** – an always-open line for instant updates.
