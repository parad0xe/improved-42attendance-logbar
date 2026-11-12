import { getLabels, loadLang, type Labels } from "./labels"
import { Attendance } from "./models/attendance"
import { MonthPlan } from "./models/month-plan"
import LAYOUT_STYLE from "./styles/layout.css"
import THEME_STYLE from "./styles/theme.css"
import { Page } from "./ui/page"
import { Settings } from "./ui/settings"
import { ThemeSwitch } from "./ui/theme-switch"

interface ShowMonthGapOptions {
    settings: Settings
    labels: Labels
    /** whether another month was shown since the start */
    isOutdated: () => boolean
}

/**
 * Calls callback when the query of the URL changes, as when the site shows another month without reloading.
 */
function watchUrl(callback: () => void): void {
    let search = location.search

    // The site changes the URL without any event, but always renders the page again.
    new MutationObserver(() => {
        if (location.search === search) { return }
        search = location.search
        callback()
    }).observe(document.body, { childList: true, subtree: true })
}

/**
 * Shows the gap of the month in the URL.
 * @returns stops watching the page
 */
async function showMonthGap({ settings, labels, isOutdated }: ShowMonthGapOptions): Promise<() => void> {
    const attendance = await Attendance.fetch(labels)
    if (isOutdated()) { return () => {} }

    const plan = MonthPlan.load(attendance)
    const page = new Page(labels)
    page.mount()

    const time = page.read()
    if (plan.isCurrentMonth()) {
        plan.syncCapsules(attendance.availableCapsules, time.monthGoalMinutes)
        plan.save()
    }
    page.render(plan, time)

    const stopWatching = page.watch(async (time) => {
        // A capsule used on the site lowers the goal of the month.
        if (plan.isCurrentMonth() && time.monthGoalMinutes !== plan.lastSync?.monthGoalMinutes) {
            const { availableCapsules } = await Attendance.fetch(labels)
            plan.syncCapsules(availableCapsules, time.monthGoalMinutes)
            plan.save()
            settings.renderCapsules(plan, availableCapsules)
        }
        page.render(plan, time)
    })

    settings.render({
        plan,
        attendance,
        onChange: () => {
            plan.save()
            page.render(plan, page.read())
        },
    })
    return stopWatching
}

async function main(): Promise<void> {
    const style = document.createElement("style")
    style.textContent = LAYOUT_STYLE + THEME_STYLE
    document.head.append(style)

    const lang = await loadLang()
    const labels = getLabels(lang)

    const themeSwitch = new ThemeSwitch(labels)
    themeSwitch.mount()

    const settings = new Settings({ lang, labels, themeSwitchElement: themeSwitch.element })
    settings.mount()

    let lastRun = 0
    let stopMonthGap = () => {}

    const start = () => requestAnimationFrame(() => requestAnimationFrame(() => {
        const run = ++lastRun
        const isOutdated = () => run !== lastRun

        stopMonthGap()
        showMonthGap({ settings, labels, isOutdated })
            .then((stop) => {
                if (isOutdated()) {
                    stop()
                    return
                }
                stopMonthGap = stop
            })
            .catch((error) => {
                if (isOutdated()) { return }
                console.error(error)
                Page.renderError(error, labels)
            })
    }))

    start()
    watchUrl(start)
}

main().catch((error) => console.error(error))
