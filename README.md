# Improved Attendance Logbar

Shows on the [42 Lyon attendance page](https://attendance.42lyon.fr/me) your bonus or missing time compared with the time expected by today, based on your own days off and planned hours

## Features

### Gap

- Shows your bonus or missing time, in hours and in days, compared with the time to have logged by today to reach the goal of the month with your plan
- Shows the time expected by today on the progress bar
- Updates by itself when your logged time changes, without reloading the page

### Settings

A block in the sidebar holds:

- a calendar to choose your days off, with weekends, public holidays and campus closures selected by default
- the hours you plan for each remaining day, 7 by default
- a switch between the light and dark themes

Your days off and planned hours are saved for each month, and your theme is remembered

### Language

The texts follow the language of the site, in French or English

## Installation

### 1. Install Tampermonkey

- [Chrome](https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- [Edge](https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd)
- [Safari](https://apps.apple.com/app/tampermonkey/id6738342400)

#### 1.1 Allow user scripts (Chrome only)

1. Open `chrome://extensions`
2. Click **Details** under Tampermonkey
3. Turn on **Allow user scripts**

On older Chrome versions, turn on **Developer mode** at the top right of `chrome://extensions` instead

### 2. Install the script

1. Open [improved-42attendance-logbar.user.js](https://raw.githubusercontent.com/parad0xe/improved-42attendance-logbar/main/improved-42attendance-logbar.user.js), then click **Install**
2. Reload the [attendance page](https://attendance.42lyon.fr/me)

## Updates

Tampermonkey checks for updates once a day.

> To update now, open the script in Tampermonkey, go to its settings and click **Check for userscript updates**
