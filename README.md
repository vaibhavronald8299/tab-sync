# tab-sync

Open a saved set of links with a short code, or sync named Chrome tab groups to this repository.

## Publish the page with GitHub Pages

1. Open this repository on GitHub and choose **Settings**.
2. In the **Pages** section, choose **Deploy from a branch**.
3. Choose the `main` branch and the `/(root)` folder, then click **Save**.
4. After GitHub finishes publishing, use the Pages URL shown in Settings to open the page. It reads the link groups from `tabs.json` in this repository.

## Create a GitHub token for the extension

1. In GitHub, open **Settings → Developer settings → Personal access tokens → Fine-grained tokens** and choose **Generate new token**.
2. Select this repository's owner, set **Repository access** to **Only select repositories**, and select `tab-sync`.
3. Under **Repository permissions**, set **Contents** to **Read and write**. Leave other permissions at their defaults, then generate the token and copy it somewhere safe.
4. In the extension popup, enter the token, your GitHub username, and `tab-sync`, then choose **Save**. The extension stores these values in Chrome's local extension storage.

## Load the Chrome extension

1. In Chrome, visit `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this repository's `extension/` folder.
3. Open the Tab Sync extension popup, enter the token, username, and repository name, and click **Save**.
4. Create or update named Chrome tab groups. After a short pause, the extension syncs their web addresses to `tabs.json`. Use **Sync Now** to trigger a sync immediately.

The extension only syncs named groups that currently have tabs. Groups not open in Chrome are kept in the JSON file.
