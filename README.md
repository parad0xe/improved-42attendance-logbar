# Improved Attendance Logbar

Shows on the [42 Lyon attendance page](https://attendance.42lyon.fr/me) your bonus or missing time compared with the time expected by today

## Features

- Shows your bonus or missing time, in hours and in days, compared with the time to have logged by today to reach the goal of the month with your plan
- Shows the time expected by today on the progress bar
- The gap updates by itself when your logged time changes, without reloading the page
- A settings block in the sidebar:
  - a calendar to choose your days off, with weekends, public holidays and campus closures selected by default
  - the hours you plan for each remaining day, 7 by default
  - a switch between the light and dark themes
- Your days off and planned hours are saved for each month, and your theme is remembered
- The texts follow the language of the site, in French or English

## Installation

1. Install Tampermonkey for your browser:
   - [Chrome](https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Edge](https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd)
   - [Safari](https://apps.apple.com/app/tampermonkey/id6738342400)
2. On Chrome only, allow user scripts:
   - open `chrome://extensions`
   - click **Details** under Tampermonkey
   - turn on **Allow user scripts**

   On older Chrome versions, turn on **Developer mode** at the top right of `chrome://extensions` instead
3. Open the install link, then click **Install**

   https://raw.githubusercontent.com/parad0xe/improved-42attendance-logbar/main/improved-42attendance-logbar.user.js

4. Reload https://attendance.42lyon.fr/me

## Updates

Tampermonkey checks for updates once a day. To update now, open the Tampermonkey menu and click **Check for userscript updates**
