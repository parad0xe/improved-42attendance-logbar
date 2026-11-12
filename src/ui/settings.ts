import type { Labels } from "../labels"
import type { Attendance } from "../models/attendance"
import type { MonthPlan } from "../models/month-plan"
import "./components/calendar"

const SELECTORS = {
    sidebarContent: "[data-slot='sidebar-content']",
}

interface SettingsOptions {
    /** the language chosen on the site, such as "fr" */
    lang: string
    /** the texts shown by the script, in lang */
    labels: Labels
    /** the row of the theme switch, shown between the plan and the credit */
    themeSwitchElement: HTMLElement
}

interface SettingsRenderOptions {
    plan: MonthPlan
    /** for the public holidays, the closures and the available capsules */
    attendance: Attendance
    /** called after each change of the plan */
    onChange: () => void
}

/**
 * The settings block at the bottom of the sidebar: the plan, the theme and the credit.
 */
export class Settings {
    /**
     * The language chosen on the site, such as "fr".
     */
    lang: string
    /**
     * The texts shown by the script, in lang.
     */
    labels: Labels
    /**
     * The block in the sidebar that holds every setting.
     */
    element: HTMLElement
    /**
     * The row of the theme switch, shown between the plan and the credit.
     */
    themeSwitchElement: HTMLElement
    /**
     * The input of the planned capsules, only in the current month.
     */
    capsulesInputElement: HTMLInputElement | null
    /**
     * The plan settings of the month shown, replaced when the month changes.
     */
    settingsContainerElement: HTMLElement | null

    constructor({ lang, labels, themeSwitchElement }: SettingsOptions) {
        this.lang = lang
        this.labels = labels
        this.themeSwitchElement = themeSwitchElement

        this.element = document.createElement("section")
        this.element.className = "improved-logbar-settings"

        this.capsulesInputElement = null
        this.settingsContainerElement = null
    }

    /**
     * Adds the theme switch and the credit, and keeps the block at the bottom of the sidebar.
     */
    mount(): void {
        this.element.append(this.themeSwitchElement)

        const creditElement = document.createElement("a")
        creditElement.className = "improved-logbar-credit"
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

    /**
     * Replaces the plan settings with the days off, the planned hours and, in the current month, the planned capsules of plan, and calls onChange after each change.
     */
    render({ plan, attendance, onChange }: SettingsRenderOptions): void {
        this.settingsContainerElement?.remove()
        this.capsulesInputElement = null

        const settingsContainerElement = document.createElement("div")
        settingsContainerElement.className = "improved-logbar-settings-container"

        const titleElement = document.createElement("span")
        titleElement.className = "improved-logbar-settings-title"
        titleElement.textContent = this.labels.DAYS_OFF

        const calendarElement = document.createElement("improved-logbar-calendar")
        calendarElement.lang = this.lang
        calendarElement.render(plan, attendance.getDayMarks())

        const hoursRowElement = document.createElement("label")
        hoursRowElement.className = "improved-logbar-settings-row"
        hoursRowElement.textContent = this.labels.HOURS_PER_REMAINING_DAY

        const hoursInputElement = document.createElement("input")
        hoursInputElement.type = "number"
        hoursInputElement.min = "0"
        hoursInputElement.max = "24"
        hoursInputElement.step = "0.5"
        hoursInputElement.value = String(plan.dailyMinutes / 60)
        hoursRowElement.append(hoursInputElement)

        calendarElement.addEventListener("change", onChange)
        hoursInputElement.addEventListener("change", () => {
            const hours = hoursInputElement.valueAsNumber
            if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
                hoursInputElement.value = String(plan.dailyMinutes / 60)
                return
            }
            plan.dailyMinutes = Math.round(hours * 60)
            onChange()
        })

        settingsContainerElement.append(titleElement, calendarElement, hoursRowElement)

        if (plan.isCurrentMonth()) {
            const capsulesRowElement = document.createElement("label")
            capsulesRowElement.className = "improved-logbar-settings-row"
            capsulesRowElement.textContent = this.labels.CAPSULES_TO_USE

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
     * Shows the planned capsules of plan, at most availableCapsules.
     */
    renderCapsules(plan: MonthPlan, availableCapsules: number): void {
        if (!this.capsulesInputElement) { return }
        this.capsulesInputElement.max = String(availableCapsules)
        this.capsulesInputElement.value = String(plan.capsules)
    }
}
