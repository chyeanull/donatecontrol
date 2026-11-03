# DONATECONTROL

Donation alerts and a fundraising thermometer for OBS, with a local NodeCG control panel.

Made by [Robert Hilsky](https://roberthilsky.com).

## Install

Requires **Node.js 22.12+** and npm.

```bash
git clone https://github.com/chyeanull/donatecontrol.git
cd donatecontrol
npm install
cp cfg/nodecg.example.json cfg/nodecg.json
npm run build
npm start
```

Open [localhost:9090/dashboard](http://localhost:9090/dashboard/), connect a campaign, and add the browser-source URLs from **Your overlays** to OBS. Provider credentials can be entered in the dashboard. Use **Mock / Demo** to try the app without an account.

For development, use `npm run dev` instead of the build/start commands.

## Features

- GoFundMe Pro / Classy, Givebutter, and DonorDrive integrations, plus a local demo. Consumer GoFundMe campaigns are not supported.
- Donation alerts and a persistent fundraising thermometer that updates as donations arrive.
- Automatic alerts or manual sending, with a saved donation list, editable names/messages, reset controls, and send counts.
- Overlay themes, Google Fonts, colors, borders, corners, and donation icons.
- Separate alert and thermometer animations, adjustable animation speed, alert duration, and uploaded alert sounds.
- Theme previews without a provider connection, local/live overlay tests, and saved campaign connection history.
