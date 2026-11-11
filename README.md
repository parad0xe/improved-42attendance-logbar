# Improved Attendance Logbar

Shows on the [42 Lyon attendance page](https://attendance.42lyon.fr/me) your bonus or missing time compared with the time expected by today

## Features

- Shows your bonus or missing time, in hours and in days, compared with 7 hours per working day elapsed in the month, without weekends, public holidays and campus closures
- Shows the time expected by today on the progress bar
- The gap updates by itself when your logged time changes, without reloading the page
- A button at the bottom right switches between the light and dark themes, and remembers your choice

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser
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
