import type { Labels } from "../labels"
import type { Attendance } from "../models/attendance"
import type { MonthPlan } from "../models/month-plan"
import "./components/calendar"

const SELECTORS = {
    sidebarContent: "[data-slot='sidebar-content']",
}

interface SettingsOptions {
    /** The language chosen on the site, such as "fr". */
    lang: string
    /** The labels in the language of the site. */
    labels: Labels
    /** The row of the theme switch. */
    themeSwitchElement: HTMLElement
}

interface SettingsRenderOptions {
    /** The plan of the month. */
    plan: MonthPlan
    /** The attendance of the month. */
    attendance: Attendance
    /** Called after each change of the plan. */
    onChange: () => void
}

/** Renders the settings block at the bottom of the sidebar. */
export class Settings {
    lang: string
    labels: Labels
    /** The block in the sidebar. */
    element: HTMLElement
    themeSwitchElement: HTMLElement
    /** The input of the planned capsules, only in the current month. */
    capsulesInputElement: HTMLInputElement | null
    /** The settings of the plan of the month. */
    settingsContainerElement: HTMLElement | null

    /** Creates the settings block. */
    constructor({ lang, labels, themeSwitchElement }: SettingsOptions) {
        this.lang = lang
        this.labels = labels
        this.themeSwitchElement = themeSwitchElement

        this.element = document.createElement("section")
        this.element.className = "improved-attendance-settings"

        this.capsulesInputElement = null
        this.settingsContainerElement = null
    }

    /** Adds the block to the bottom of the sidebar, and keeps it there. */
    mount(): void {
        this.element.append(this.themeSwitchElement)

        const creditElement = document.createElement("a")
        creditElement.className = "improved-attendance-credit"
        creditElement.href = "https://github.com/parad0xe"
        creditElement.target = "_blank"
        creditElement.rel = "noopener noreferrer"
        creditElement.textContent = "@nlallema"
        this.element.append(creditElement)

        // The sidebar content can be rendered again, for example when the mobile sidebar opens.
        const attach = () => {
            const sidebarContentElement = document.querySelector(SELECTORS.sidebarContent)
            if (sidebarContentElement && !sidebarContentElement.contains(this.element)) {
                sidebarContentElement.append(this.element)
            }
        }
        attach()
        new MutationObserver(attach).observe(document.body, { childList: true, subtree: true })
    }

    /** Renders the plan of the month, and calls `onChange` after each change. */
    render({ plan, attendance, onChange }: SettingsRenderOptions): void {
        this.settingsContainerElement?.remove()
        this.capsulesInputElement = null

        const settingsContainerElement = document.createElement("div")
        settingsContainerElement.className = "improved-attendance-settings-container"

        const titleElement = document.createElement("span")
        titleElement.className = "improved-attendance-settings-title"
        titleElement.textContent = this.labels.SETTINGS_DAYS_OFF

        const calendarElement = document.createElement("improved-attendance-calendar")
        calendarElement.lang = this.lang
        calendarElement.render(plan, attendance.getDayMarks())

        const dailyTimeRowElement = document.createElement("label")
        dailyTimeRowElement.className = "improved-attendance-settings-row"
        dailyTimeRowElement.textContent = this.labels.SETTINGS_TIME_PER_REMAINING_DAY

        const hoursInputElement = document.createElement("input")
        hoursInputElement.type = "number"
        hoursInputElement.min = "0"
        hoursInputElement.max = "24"
        hoursInputElement.step = "1"

        // -1 and 60 let the arrows carry over to the hours.
        const minutesInputElement = document.createElement("input")
        minutesInputElement.type = "number"
        minutesInputElement.min = "-1"
        minutesInputElement.max = "60"
        minutesInputElement.step = "1"

        const renderDailyTime = () => {
            hoursInputElement.value = String(Math.floor(plan.dailyMinutes / 60))
            minutesInputElement.value = String(plan.dailyMinutes % 60)
        }
        renderDailyTime()

        const dailyTimeInputsElement = document.createElement("span")
        dailyTimeInputsElement.className = "improved-attendance-daily-time-inputs"
        dailyTimeInputsElement.append(hoursInputElement, "h", minutesInputElement)
        dailyTimeRowElement.append(dailyTimeInputsElement)

        calendarElement.addEventListener("change", onChange)
        const onDailyTimeChange = () => {
            const hours = hoursInputElement.valueAsNumber
            const minutes = minutesInputElement.valueAsNumber
            if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
                renderDailyTime()
                return
            }
            plan.dailyMinutes = Math.min(Math.max(0, Math.round(hours * 60 + minutes)), 24 * 60)
            renderDailyTime()
            onChange()
        }
        hoursInputElement.addEventListener("change", onDailyTimeChange)
        minutesInputElement.addEventListener("change", onDailyTimeChange)

        settingsContainerElement.append(titleElement, calendarElement, dailyTimeRowElement)

        if (plan.isCurrentMonth()) {
            const capsulesRowElement = document.createElement("label")
            capsulesRowElement.className = "improved-attendance-settings-row"
            capsulesRowElement.textContent = this.labels.SETTINGS_CAPSULES_TO_USE

            const capsulesInputElement = document.createElement("input")
            capsulesInputElement.type = "number"
            capsulesInputElement.min = "0"
            capsulesInputElement.step = "1"
            this.capsulesInputElement = capsulesInputElement
            this.renderCapsules(plan, attendance.availableCapsules)
            capsulesRowElement.append(capsulesInputElement)

            capsulesInputElement.addEventListener("change", () => {
                const capsules = capsulesInputElement.valueAsNumber
                if (!Number.isInteger(capsules) || capsules < 0) {
                    capsulesInputElement.value = String(plan.capsules)
                    return
                }
                plan.capsules = Math.min(capsules, Number(capsulesInputElement.max))
                capsulesInputElement.value = String(plan.capsules)
                onChange()
            })

            settingsContainerElement.append(capsulesRowElement)
        }

        this.settingsContainerElement = settingsContainerElement
        this.element.prepend(settingsContainerElement)
    }

    /**
     * Renders the planned capsules of `plan`, at most `availableCapsules`.
     * @param plan - the plan of the month
     * @param availableCapsules - the number of capsules left to use
     */
    renderCapsules(plan: MonthPlan, availableCapsules: number): void {
        if (!this.capsulesInputElement) { return }
        this.capsulesInputElement.max = String(availableCapsules)
        this.capsulesInputElement.value = String(plan.capsules)
    }
}
