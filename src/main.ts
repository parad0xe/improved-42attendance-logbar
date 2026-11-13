import { getLabels, loadLang, type Labels } from "./labels"
import { Attendance } from "./models/attendance"
import { MonthPlan } from "./models/month-plan"
import LAYOUT_STYLE from "./styles/layout.css"
import THEME_STYLE from "./styles/theme.css"
import { Page } from "./ui/page"
import { Settings } from "./ui/settings"
import { ThemeSwitch } from "./ui/theme-switch"

interface StartMonthImprovementsOptions {
    /** The `Settings` object that renders the plan of the month. */
    settings: Settings
    /** The labels in the language of the site. */
    labels: Labels
    /** Returns whether another month was shown since the start. */
    isOutdated: () => boolean
}

/**
 * Calls `onChange` each time the query of the URL changes.
 * @param onChange - called when the site shows another month
 */
function watchUrl(onChange: () => void): void {
    let search = location.search

    // The site changes the URL without any event, but always renders the page again.
    new MutationObserver(() => {
        if (location.search === search) { return }
        search = location.search
        onChange()
    }).observe(document.body, { childList: true, subtree: true })
}

/** Starts the improvements of the month in the URL, and returns a function that stops them. */
async function startMonthImprovements({ settings, labels, isOutdated }: StartMonthImprovementsOptions): Promise<() => void> {
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

function main(): void {
    const styleElement = document.createElement("style")
    styleElement.textContent = LAYOUT_STYLE + THEME_STYLE
    document.head.append(styleElement)

    const lang = loadLang()
    const labels = getLabels(lang)

    const themeSwitch = new ThemeSwitch(labels)
    themeSwitch.mount()

    const settings = new Settings({ lang, labels, themeSwitchElement: themeSwitch.element })
    settings.mount()

    let lastRun = 0
    let stopMonthImprovements = () => {}

    const restartMonthImprovements = () => requestAnimationFrame(() => requestAnimationFrame(() => {
        const run = ++lastRun
        const isOutdated = () => run !== lastRun

        stopMonthImprovements()
        startMonthImprovements({ settings, labels, isOutdated })
            .then((stop) => {
                if (isOutdated()) {
                    stop()
                    return
                }
                stopMonthImprovements = stop
            })
            .catch((error) => {
                if (isOutdated()) { return }
                console.error(error)
                Page.renderError(error, labels)
            })
    }))

    restartMonthImprovements()
    watchUrl(restartMonthImprovements)
}

main()
