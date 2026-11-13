import { EXTENSION_NAME } from "../constants"
import type { Labels } from "../labels"
import { formatMinutes, parseMinutes } from "../lib/time"
import type { MonthPlan, MonthTime } from "../models/month-plan"

const SELECTORS = {
    main: "[data-slot='sidebar-inset'] main",
    summary: "[data-slot='sidebar-inset'] main div:nth-of-type(2) div:nth-of-type(1)",
    progressTrack: "[data-slot='sidebar-inset'] main div:nth-of-type(2) div:nth-of-type(2) div:nth-of-type(2)",
    loggedMonth: "[data-slot='sidebar-inset'] main div:nth-of-type(2) > div div:nth-of-type(2) span:nth-of-type(1)",
    monthGoal: "[data-slot='sidebar-inset'] main div:nth-of-type(2) > div div:nth-of-type(2) span:nth-of-type(3)",
    timerParts: "[data-slot='sidebar-inset'] main div:nth-of-type(3) div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div > span",
    runningSession: "[data-slot='sidebar-inset'] main div:nth-of-type(3) div:nth-of-type(2) > div > div div > span:nth-of-type(1)",
    loggedToday: "[data-slot='sidebar-inset'] main div:nth-of-type(3) div:nth-of-type(2) > div > div div > span:nth-of-type(2)",
}

/**
 * Returns the text of the element at `selector`, and whether it exists.
 * @param selector - the selector of an element that shows a time
 */
function readTimeText(selector: string): [string, boolean] {
    const element = document.querySelector(selector)
    if (!element) {
        return ["00:00", false]
    }
    return [element.textContent, true]
}

/**
 * Returns whether `a` and `b` have the same times.
 * @param a - the logged times and the time to log in the month, in minutes
 * @param b - the logged times and the time to log in the month, in minutes
 */
function isSameTime(a: MonthTime, b: MonthTime): boolean {
    return a.loggedMonthMinutes === b.loggedMonthMinutes
        && a.monthGoalMinutes === b.monthGoalMinutes
        && a.runningSessionMinutes === b.runningSessionMinutes
        && a.loggedTodayMinutes === b.loggedTodayMinutes
}

export class Page {
    labels: Labels
    /** The summary of the month, where the gap is shown. */
    summaryElement: Element
    /** The progress bar of the month, where the expected bar is shown. */
    progressTrackElement: Element

    /**
     * Finds the summary and the progress bar of the month.
     * @param labels - the labels in the language of the site
     */
    constructor(labels: Labels) {
        this.labels = labels

        const summaryElement = document.querySelector(SELECTORS.summary)
        if (!summaryElement) {
            throw new Error(`${EXTENSION_NAME}: ${this.labels.ERROR_SUMMARY_NOT_FOUND}`)
        }
        this.summaryElement = summaryElement

        const progressTrackElement = document.querySelector(SELECTORS.progressTrack)
        if (!progressTrackElement) {
            throw new Error(`${EXTENSION_NAME}: ${this.labels.ERROR_PROGRESS_BAR_NOT_FOUND}`)
        }
        this.progressTrackElement = progressTrackElement
    }

    /** Prepares the progress bar of the site to hold the expected bar. */
    mount(): void {
        this.progressTrackElement.classList.add("relative")
        this.progressTrackElement.querySelector("div")!.classList.add("relative", "z-[1]")
    }

    read(): MonthTime {
        let [loggedMonthText, hasLoggedMonth] = readTimeText(SELECTORS.loggedMonth)
        if (!hasLoggedMonth) {
            throw new Error(`${EXTENSION_NAME}: ${this.labels.ERROR_LOGGED_MONTH_NOT_FOUND}`)
        }

        let [monthGoalText, hasMonthGoal] = readTimeText(SELECTORS.monthGoal)
        if (!hasMonthGoal) {
            throw new Error(`${EXTENSION_NAME}: ${this.labels.ERROR_MONTH_GOAL_NOT_FOUND}`)
        }

        let isTimerStarted = document.querySelectorAll(SELECTORS.timerParts).length === 2
        let [runningSessionText, hasRunningSession] = isTimerStarted
            ? readTimeText(SELECTORS.runningSession)
            : ["00:00", true]
        if (!hasRunningSession) {
            console.warn(`${EXTENSION_NAME}: ${this.labels.WARNING_RUNNING_SESSION_NOT_FOUND}`)
        }

        // Without any log today, the site shows no time for today.
        let [loggedTodayText] = readTimeText(SELECTORS.loggedToday)

        return {
            loggedMonthMinutes: parseMinutes(loggedMonthText),
            monthGoalMinutes: parseMinutes(monthGoalText),
            runningSessionMinutes: parseMinutes(runningSessionText.replace("+", "").trim()),
            loggedTodayMinutes: parseMinutes(loggedTodayText.trim()),
        }
    }

    /**
     * Renders the expected bar and the gap.
     * @param plan - the plan of the month
     * @param time - the logged times and the time to log in the month, in minutes
     */
    render(plan: MonthPlan, time: MonthTime): void {
        this.renderExpectedBar(plan, time)
        this.renderGap(plan, time)
    }

    /**
     * Renders the expected bar while the logged time is behind it.
     * @param plan - the plan of the month
     * @param time - the logged times and the time to log in the month, in minutes
     */
    private renderExpectedBar(plan: MonthPlan, time: MonthTime): void {
        const expectedMinutes = plan.getExpectedMinutes(time.monthGoalMinutes)
        let expectedBarElement = this.progressTrackElement.querySelector<HTMLElement>(".improved-attendance-expected-bar")

        const loggedTotalMinutes = time.loggedMonthMinutes + time.runningSessionMinutes
        if (time.loggedMonthMinutes >= plan.getGoalMinutes(time.monthGoalMinutes) || expectedMinutes <= loggedTotalMinutes) {
            expectedBarElement?.remove()
            return
        }

        if (!expectedBarElement) {
            expectedBarElement = document.createElement("div")
            expectedBarElement.classList.add("improved-attendance-expected-bar")
            expectedBarElement.style.width = `0%`
            this.progressTrackElement.appendChild(expectedBarElement)
        }

        let expectedBarLabelElement = this.progressTrackElement.querySelector(".improved-attendance-expected-bar-label")
        if (!expectedBarLabelElement) {
            expectedBarLabelElement = document.createElement("span")
            expectedBarLabelElement.classList.add("improved-attendance-expected-bar-label")
            expectedBarElement.append(expectedBarLabelElement)
        }
        expectedBarLabelElement.textContent = `${formatMinutes(expectedMinutes)}`

        setTimeout(() => {
            expectedBarElement.style.width = `${expectedMinutes / time.monthGoalMinutes * 100}%`
        }, 30)
    }

    /**
     * Renders the gap between the logged and the expected time.
     * @param plan - the plan of the month
     * @param time - the logged times and the time to log in the month, in minutes
     */
    private renderGap(plan: MonthPlan, time: MonthTime): void {
        this.summaryElement.querySelector(".improved-attendance-gap-container")?.remove()

        if (time.loggedMonthMinutes >= plan.getGoalMinutes(time.monthGoalMinutes)) { return }

        this.summaryElement.classList.add("improved-attendance-summary")

        const { start, end } = plan.getExpectedRange(time.monthGoalMinutes)
        const loggedTotalMinutes = time.loggedMonthMinutes + time.runningSessionMinutes
        const expectedMinutes = loggedTotalMinutes < start ? start : end
        const gapMinutes = Math.abs(expectedMinutes - loggedTotalMinutes)
        const gapDays = gapMinutes / plan.dailyMinutes

        let gapDirection
        if (loggedTotalMinutes < start) {
            gapDirection = {
                label: `-${formatMinutes(gapMinutes)}`,
                className: "improved-attendance-missing",
                formatDays: this.labels.GAP_MISSING_DAYS,
            }
        } else if (loggedTotalMinutes < end) {
            gapDirection = {
                label: this.labels.GAP_REMAINING_TODAY(formatMinutes(gapMinutes)),
                className: "improved-attendance-in-progress",
                formatDays: null,
            }
        } else {
            gapDirection = {
                label: `+${formatMinutes(gapMinutes)}`,
                className: "improved-attendance-bonus",
                formatDays: this.labels.GAP_BONUS_DAYS,
            }
        }

        const gapContainerElement = document.createElement("span")
        gapContainerElement.className = "improved-attendance-gap-container"
        this.summaryElement.prepend(gapContainerElement)

        const gapTimeElement = document.createElement("strong")
        gapTimeElement.classList.add(gapDirection.className)
        gapTimeElement.title = this.labels.GAP_EXPECTED(formatMinutes(expectedMinutes))
        gapTimeElement.textContent = gapDirection.label
        gapContainerElement.prepend(gapTimeElement)

        if (plan.dailyMinutes > 0 && gapDirection.formatDays) {
            const gapDaysElement = document.createElement("span")
            gapDaysElement.className = "improved-attendance-gap-days"
            gapDaysElement.classList.add(gapDirection.className)
            gapDaysElement.textContent = `(${gapDirection.formatDays(gapDays)})`
            gapContainerElement.append(gapDaysElement)
        }

        if (plan.isCurrentMonth() && plan.capsules > 0) {
            const gapCapsuleElement = document.createElement("span")
            gapCapsuleElement.className = "improved-attendance-gap-capsule"
            gapCapsuleElement.textContent = `(${this.labels.GAP_CAPSULES_LEFT(plan.capsules)})`
            gapContainerElement.append(gapCapsuleElement)
        }
    }

    /**
     * Calls `onChange` with the new time each time it changes, and returns a function that stops watching.
     * @param onChange - called with the new logged times and time to log in the month
     */
    watch(onChange: (time: MonthTime) => void | Promise<void>): () => void {
        let time = this.read()

        const stop = (error: unknown) => {
            observer.disconnect()
            console.error(error)
            Page.renderError(error, this.labels)
        }

        const observer = new MutationObserver(() => {
            try {
                const newTime = this.read()
                if (isSameTime(newTime, time)) { return }

                time = newTime
                Promise.resolve(onChange(time)).catch(stop)
            } catch (error) {
                stop(error)
            }
        })
        observer.observe(document.querySelector(SELECTORS.main)!, { childList: true, subtree: true, characterData: true })
        return () => observer.disconnect()
    }

    /**
     * Replaces the gap with the error.
     * @param error - the error that stopped the improvements of the month
     * @param labels - the labels in the language of the site
     */
    static renderError(error: unknown, labels: Labels): void {
        const summaryElement = document.querySelector(SELECTORS.summary)
        if (summaryElement) {
            summaryElement.querySelector(".improved-attendance-gap-container")?.remove()

            const errorElement = document.createElement("span")
            errorElement.className = "improved-attendance-gap-container"
            errorElement.title = error instanceof Error ? error.message : String(error)
            errorElement.textContent = labels.GAP_UNAVAILABLE
            summaryElement.prepend(errorElement)
        }
    }
}
