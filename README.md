# remote pc control

full-featured remote desktop control application. control your windows pc from any device with a web browser.

## features

- real-time screen streaming (5-30 fps adjustable)
- mouse control (movement, clicks, scroll, right-click, double-click)
- keyboard input with shortcuts (ctrl+c, ctrl+v, ctrl+z, etc)
- special keys (esc, tab, arrows, function keys)
- integrated powershell terminal
- touch-optimized for chromebooks and tablets
- adjustable quality and performance settings
- token-based authentication

## local setup

install dependencies:

```bash
npm install
```

set your auth token (windows powershell):

```powershell
$env:AUTH_TOKEN="your_secure_token_here"
npm start
```

linux/mac:

```bash
AUTH_TOKEN="your_secure_token_here" npm start
```

find your pc ip address (windows):

```powershell
ipconfig
```

access from chromebook or any device on your network:

```
http://<your-pc-ip>:3000
```

## deploy to render

1. push this folder to a github repository
2. create a new web service on render.com
3. connect your github repo
4. set build command: `npm install`
5. set start command: `npm start`
6. add environment variable: `AUTH_TOKEN` with your secure token
7. deploy

**important**: render deployments require the server to run on the same machine you want to control. for remote pc control, you need to run this on your actual windows pc, not on render's servers.

## recommended usage

**for local network access** (chromebook to windows pc on same wifi):
- run the server on your windows pc
- access from chromebook using local ip address
- best performance, lowest latency

**for internet access** (control pc from anywhere):
- run the server on your windows pc
- expose port 3000 through your router (port forwarding)
- or use ngrok: `npx ngrok http 3000`
- access using your public ip or ngrok url

## performance tuning

adjust settings in the web interface:
- **quality**: 30-90% (lower = faster, higher = clearer)
- **fps**: 5-30 (lower = less bandwidth, higher = smoother)
- **scale**: 40-100% (lower = faster, higher = more detail)

recommended settings for chromebook over wifi:
- quality: 60%
- fps: 15
- scale: 70%

## security

- change the default auth token before exposing to internet
- use https with a reverse proxy (nginx/caddy) for production
- only expose to trusted networks
- consider vpn instead of port forwarding for remote access

## requirements

- node.js 18 or higher
- windows, macos, or linux
- works best on same local network
