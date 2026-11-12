import { WORKDAY_MINUTES } from "../constants"
import { getDaysInMonth } from "../lib/time"
import type { Attendance } from "./attendance"

const PLAN_STORAGE_KEY = "improved-logbar-plan"

interface CapsuleSync {
    availableCapsules: number
    /** the goal shown by the site */
    monthGoalMinutes: number
}

interface MonthPlanData {
    /** the days of the month, from 1, with no planned time */
    daysOff: number[]
    /** the time planned on each remaining day */
    dailyMinutes: number
    /** the capsules planned to be used this month */
    capsules?: number
    /** what the site showed at the last capsule sync */
    lastSync?: CapsuleSync | null
}

interface MonthPlanOptions {
    year: number
    /** 0 for January */
    monthIndex: number
    /** the days of the month, from 1, with no planned time */
    daysOff: Set<number>
    /** the time planned on each remaining day */
    dailyMinutes: number
    /** the capsules planned to be used this month */
    capsules: number
    /** what the site showed at the last capsule sync */
    lastSync: CapsuleSync | null
}

export class MonthPlan {
    year: number
    monthIndex: number
    daysOff: Set<number>
    dailyMinutes: number
    capsules: number
    lastSync: CapsuleSync | null

    constructor({ year, monthIndex, daysOff, dailyMinutes, capsules, lastSync }: MonthPlanOptions) {
        this.year = year
        this.monthIndex = monthIndex
        this.daysOff = daysOff
        this.dailyMinutes = dailyMinutes
        this.capsules = capsules
        this.lastSync = lastSync
    }

    /**
     * @returns the storage key of the plan of this month
     */
    static storageKey(year: number, monthIndex: number): string {
        return `${PLAN_STORAGE_KEY}-${year}-${String(monthIndex + 1).padStart(2, '0')}`
    }

    /**
     * Loads the saved plan of the month of attendance, or else a plan with its days that are not open workdays as days off.
     */
    static load(attendance: Attendance): MonthPlan {
        const { year, monthIndex } = attendance.calendar

        try {
            const savedPlan = localStorage.getItem(MonthPlan.storageKey(year, monthIndex))
            if (savedPlan !== null) {
                const { daysOff, dailyMinutes, capsules = 0, lastSync = null }: MonthPlanData = JSON.parse(savedPlan)
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
        const storedPlan: MonthPlanData = {
            daysOff: [...this.daysOff],
            dailyMinutes: this.dailyMinutes,
            capsules: this.capsules,
            lastSync: this.lastSync,
        }

        try {
            localStorage.setItem(MonthPlan.storageKey(this.year, this.monthIndex), JSON.stringify(storedPlan))
        } catch {
            // Without storage, the plan lasts until the page is reloaded.
        }
    }

    /**
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
     * @returns the days after now that are not days off
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
     * @returns the minutes to have logged by today to reach the goal with the planned time
     */
    getExpectedMinutes(monthGoalMinutes: number): number {
        return this.getExpectedRange(monthGoalMinutes).end
    }

    isCurrentMonth(now = new Date()): boolean {
        return this.year === now.getFullYear() && this.monthIndex === now.getMonth()
    }

    /**
     * Reports whether time is planned on the day of now, in the month of the plan.
     */
    isPlannedDay(now = new Date()): boolean {
        return this.isCurrentMonth(now) && !this.daysOff.has(now.getDate())
    }

    /**
     * The capsules count only in the current month, as the available capsules are shared by every month.
     * @param monthGoalMinutes - the goal shown by the site
     * @param now
     * @returns the goal lowered by a workday for each planned capsule
     */
    getGoalMinutes(monthGoalMinutes: number, now = new Date()): number {
        if (!this.isCurrentMonth(now)) { return monthGoalMinutes }
        return monthGoalMinutes - this.capsules * WORKDAY_MINUTES
    }

    /**
     * Removes the capsules used since the last sync from the planned ones, and keeps at most availableCapsules.
     * A capsule counts as used when the available capsules and the goal of the month both went down.
     * @param availableCapsules
     * @param monthGoalMinutes - the goal shown by the site
     */
    syncCapsules(availableCapsules: number, monthGoalMinutes: number): void {
        if (this.lastSync) {
            const usedCapsules = Math.min(
                this.lastSync.availableCapsules - availableCapsules,
                Math.round((this.lastSync.monthGoalMinutes - monthGoalMinutes) / WORKDAY_MINUTES),
            )
            this.capsules -= Math.max(0, usedCapsules)
        }
        this.capsules = Math.max(0, Math.min(this.capsules, availableCapsules))
        this.lastSync = { availableCapsules, monthGoalMinutes }
    }

    /**
     * @param monthGoalMinutes - the goal shown by the site
     * @param now
     * @returns the minutes to have logged at the start and at the end of the day of now
     */
    getExpectedRange(monthGoalMinutes: number, now = new Date()): { start: number, end: number } {
        const end = this.getGoalMinutes(monthGoalMinutes, now) - this.countRemainingDays(now) * this.dailyMinutes
        const start = this.isPlannedDay(now) ? end - this.dailyMinutes : end
        return { start, end }
    }
}
