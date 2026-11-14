import { WORKDAY_MINUTES } from "../constants"
import { getDaysInMonth } from "../lib/time"
import type { Attendance } from "./attendance"

const PLAN_STORAGE_KEY = "improved-attendance-plan"

interface PlanSync {
    availableCapsules: number
    /** The time to log in the month, in minutes. */
    monthGoalMinutes: number
}

interface StoredMonthPlan {
    daysOff: number[]
    dailyMinutes: number
    capsules?: number
    lastSync?: PlanSync | null
}

interface MonthPlanOptions {
    /** The year of the month. */
    year: number
    /** The month, 0 for January. */
    monthIndex: number
    /** The days of the month, from 1, with no planned time. */
    daysOff: Set<number>
    /** The time planned on each remaining day, in minutes. */
    dailyMinutes: number
    /** The number of capsules planned to be used this month. */
    capsules: number
    /** The last sync of the plan. */
    lastSync: PlanSync | null
}

export interface MonthTime {
    /** The time logged in the month, without the running session, in minutes. */
    loggedMonthMinutes: number
    /** The time to log in the month, in minutes. */
    monthGoalMinutes: number
    /** The time of the running session, in minutes. */
    runningSessionMinutes: number
    /** The time logged today, with the running session, in minutes. */
    loggedTodayMinutes: number
}

export class MonthPlan {
    year: number
    monthIndex: number
    daysOff: Set<number>
    dailyMinutes: number
    capsules: number
    lastSync: PlanSync | null

    /** Creates the plan of a month. */
    constructor({ year, monthIndex, daysOff, dailyMinutes, capsules, lastSync }: MonthPlanOptions) {
        this.year = year
        this.monthIndex = monthIndex
        this.daysOff = daysOff
        this.dailyMinutes = dailyMinutes
        this.capsules = capsules
        this.lastSync = lastSync
    }

    /**
     * Returns the storage key of the plan of the month.
     * @param year - the year of the month
     * @param monthIndex - 0 for January
     */
    static getStorageKey(year: number, monthIndex: number): string {
        return `${PLAN_STORAGE_KEY}-${year}-${String(monthIndex + 1).padStart(2, '0')}`
    }

    /**
     * Loads the saved plan of the month of `attendance`, or creates a new one.
     * @param attendance - the attendance of the month
     */
    static load(attendance: Attendance): MonthPlan {
        const { year, monthIndex } = attendance.calendar

        try {
            const storedPlanJson = localStorage.getItem(MonthPlan.getStorageKey(year, monthIndex))
            if (storedPlanJson !== null) {
                const { daysOff, dailyMinutes, capsules = 0, lastSync = null }: StoredMonthPlan = JSON.parse(storedPlanJson)
                const isValidSync = lastSync === null
                    || (Number.isInteger(lastSync.availableCapsules) && Number.isFinite(lastSync.monthGoalMinutes))
                if (Array.isArray(daysOff) && daysOff.every(Number.isInteger) && Number.isFinite(dailyMinutes) && dailyMinutes >= 0
                    && Number.isInteger(capsules) && capsules >= 0 && isValidSync) {
                    return new MonthPlan({ year, monthIndex, daysOff: new Set(daysOff), dailyMinutes, capsules, lastSync })
                }
            }
        } catch {
            // The storage can be unavailable, or the saved plan unreadable.
        }

        const daysOff = new Set<number>()
        for (let day = 1; day <= getDaysInMonth(year, monthIndex); day++) {
            if (!attendance.isOpenWorkday(new Date(year, monthIndex, day))) {
                daysOff.add(day)
            }
        }

        return new MonthPlan({ year, monthIndex, daysOff, dailyMinutes: WORKDAY_MINUTES, capsules: 0, lastSync: null })
    }

    save(): void {
        const storedPlan: StoredMonthPlan = {
            daysOff: [...this.daysOff],
            dailyMinutes: this.dailyMinutes,
            capsules: this.capsules,
            lastSync: this.lastSync,
        }

        try {
            localStorage.setItem(MonthPlan.getStorageKey(this.year, this.monthIndex), JSON.stringify(storedPlan))
        } catch {
            // Without storage, the plan lasts until the page is reloaded.
        }
    }

    /**
     * Toggles whether `day` is a day off.
     * @param day - the day of the month, from 1
     */
    toggleDayOff(day: number): void {
        if (this.daysOff.has(day)) {
            this.daysOff.delete(day)
        } else {
            this.daysOff.add(day)
        }
    }

    /**
     * Returns the number of days after `now` that are not days off.
     * @param now - the current date
     */
    countRemainingDays(now = new Date()): number {
        let remainingDays = 0
        for (let day = 1; day <= getDaysInMonth(this.year, this.monthIndex); day++) {
            const date = new Date(this.year, this.monthIndex, day)
            if (date > now && !this.daysOff.has(day)) {
                remainingDays++
            }
        }

        return remainingDays
    }

    /**
     * Returns the time to have logged by the end of today, in minutes.
     * @param monthGoalMinutes - the time to log in the month, in minutes
     */
    getExpectedMinutes(monthGoalMinutes: number): number {
        return this.getExpectedRange(monthGoalMinutes).end
    }

    /**
     * Returns whether the plan is for the month of `now`.
     * @param now - the current date
     */
    isCurrentMonth(now = new Date()): boolean {
        return this.year === now.getFullYear() && this.monthIndex === now.getMonth()
    }

    /**
     * Returns whether time is planned on the day of `now`.
     * @param now - the current date
     */
    isPlannedDay(now = new Date()): boolean {
        return this.isCurrentMonth(now) && !this.daysOff.has(now.getDate())
    }

    /**
     * Returns the time to log in the month, in minutes, lowered by the planned capsules in the current month.
     * @param monthGoalMinutes - the time to log in the month, in minutes
     * @param now - the current date
     */
    getGoalMinutes(monthGoalMinutes: number, now = new Date()): number {
        if (!this.isCurrentMonth(now)) { return monthGoalMinutes }
        return monthGoalMinutes - this.capsules * WORKDAY_MINUTES
    }

    /**
     * Removes the capsules used since the last sync from the planned ones, and keeps `planSync` as the last sync.
     * @param planSync - the new sync of the plan
     */
    sync(planSync: PlanSync): void {
        const { availableCapsules } = planSync
        if (this.lastSync) {
            const capsulesDiff = availableCapsules - this.lastSync.availableCapsules
            if (capsulesDiff < 0) {
                this.capsules += capsulesDiff
            }
        }
        this.capsules = Math.max(0, Math.min(this.capsules, availableCapsules))
        this.lastSync = planSync
    }

    /**
     * Returns the time to have logged at the start and at the end of the day of `now`, in minutes.
     * @param monthGoalMinutes - the time to log in the month, in minutes
     * @param now - the current date
     */
    getExpectedRange(monthGoalMinutes: number, now = new Date()): { start: number, end: number } {
        const end = this.getGoalMinutes(monthGoalMinutes, now) - this.countRemainingDays(now) * this.dailyMinutes
        const start = this.isPlannedDay(now) ? end - this.dailyMinutes : end
        return { start, end }
    }

    /**
     * Returns the time to log on each planned day from today to reach the goal, in minutes, or null when no day is planned.
     * @param time - the logged times and the time to log in the month, in minutes
     * @param now - the current date
     */
    getNeededDailyMinutes(time: MonthTime, now = new Date()): number | null {
        const isPlannedDay = this.isPlannedDay(now)
        const plannedDays = this.countRemainingDays(now) + (isPlannedDay ? 1 : 0)
        if (plannedDays === 0) { return null }

        // A planned today counts as a full day.
        const completedTodayMinutes = time.loggedTodayMinutes - time.runningSessionMinutes
        const loggedMinutes = isPlannedDay
            ? time.loggedMonthMinutes - completedTodayMinutes
            : time.loggedMonthMinutes + time.runningSessionMinutes
        return Math.ceil(Math.max(0, this.getGoalMinutes(time.monthGoalMinutes, now) - loggedMinutes) / plannedDays)
    }

    /**
     * Returns the time logged by the end of the month when the plan is followed, in minutes.
     * @param time - the logged times and the time to log in the month, in minutes
     * @param now - the current date
     */
    getProjectedMinutes(time: MonthTime, now = new Date()): number {
        const loggedTotalMinutes = time.loggedMonthMinutes + time.runningSessionMinutes
        const remainingTodayMinutes = this.isPlannedDay(now) ? Math.max(0, this.dailyMinutes - time.loggedTodayMinutes) : 0
        return loggedTotalMinutes + remainingTodayMinutes + this.countRemainingDays(now) * this.dailyMinutes
    }
}
