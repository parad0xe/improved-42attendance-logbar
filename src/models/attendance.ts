import { EXTENSION_NAME, WORKDAY_MINUTES } from "../constants"
import type { Labels } from "../labels"
import { decodeDevalue } from "../lib/devalue"
import { getDaysInMonth } from "../lib/time"

const CLOSURE_START_HOUR = 8
const CLOSURE_END_HOUR = 20

interface AttendanceCalendar {
    year: number
    /** 0 for January */
    monthIndex: number
    /** the working days of the month, without weekends and public holidays */
    workdays: Date[]
}

interface AttendanceClosure {
    beginAt: Date
    endAt: Date
}

interface AttendanceHistory {
    /** the times when the campus is closed */
    closures: AttendanceClosure[]
}

export type DayMark = "public-holiday" | "closure"

export class Attendance {
    calendar: AttendanceCalendar
    history: AttendanceHistory
    /**
     * The capsules left to use, shared by every month.
     */
    availableCapsules: number

    /**
     * @param data - the decoded data of the /me page
     * @param labels - for the error messages
     */
    constructor(data: Record<string, any>, labels: Labels) {
        const { calendar, history } = data

        if (!Array.isArray(calendar?.workdays) || !calendar.workdays.every((day: unknown) => day instanceof Date)) {
            throw new Error(`${EXTENSION_NAME}: ${labels.ERROR_WORKDAYS_MISSING}`)
        }

        this.calendar = {
            year: calendar.year,
            monthIndex: calendar.monthIndex,
            workdays: calendar.workdays,
        }

        this.history = {
            closures: history?.closures ?? [],
        }

        this.availableCapsules = Array.isArray(data.availableCapsules) ? data.availableCapsules.length : 0
    }

    /**
     * Reports whether closures cover a full workday between 08:00 and 20:00, as on the site.
     */
    isClosedDay(date: Date): boolean {
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), CLOSURE_START_HOUR)
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), CLOSURE_END_HOUR)

        let closedMinutes = 0
        for (const closure of this.history.closures) {
            const start = closure.beginAt > dayStart ? closure.beginAt : dayStart
            const end = closure.endAt < dayEnd ? closure.endAt : dayEnd
            if (end > start) {
                closedMinutes += (end.getTime() - start.getTime()) / (60 * 1000)
            }
        }

        return closedMinutes >= WORKDAY_MINUTES
    }

    /**
     * @returns whether date is in the workdays of the month
     */
    isWorkday(date: Date): boolean {
        return this.calendar.workdays.some((workday) => workday.toDateString() === date.toDateString())
    }

    /**
     * Reports whether time is expected on date: a workday when the campus is not closed.
     */
    isOpenWorkday(date: Date): boolean {
        return this.isWorkday(date) && !this.isClosedDay(date)
    }

    /**
     * @returns the public holidays and the closed workdays of the month, by day from 1
     */
    getDayMarks(): Map<number, DayMark> {
        const { year, monthIndex } = this.calendar

        const dayMarks = new Map<number, DayMark>()
        for (let day = 1; day <= getDaysInMonth(year, monthIndex); day++) {
            const date = new Date(year, monthIndex, day)
            const isWeekend = date.getDay() === 0 || date.getDay() === 6
            if (!isWeekend && !this.isWorkday(date)) {
                dayMarks.set(day, "public-holiday")
            } else if (this.isWorkday(date) && this.isClosedDay(date)) {
                dayMarks.set(day, "closure")
            }
        }

        return dayMarks
    }

    /**
     * Loads the attendance data of the month shown by the page.
     * @param labels - for the error messages
     */
    static async fetch(labels: Labels): Promise<Attendance> {
        const response = await fetch(`/me/__data.json${location.search}`, { credentials: "same-origin" })
        if (!response.ok) {
            throw new Error(`${EXTENSION_NAME}: ${labels.ERROR_DATA_UNAVAILABLE(response.status)}`)
        }

        // SvelteKit can stream more chunks on the next lines; the page data is the first one.
        const page = JSON.parse((await response.text()).split("\n")[0])
        if (page.type === "redirect") {
            throw new Error(`${EXTENSION_NAME}: ${labels.ERROR_SESSION_EXPIRED}`)
        }

        const data = Object.assign({}, ...(page.nodes ?? [])
            .filter((node: any) => node?.type === "data" && Array.isArray(node.data))
            .map((node: any) => decodeDevalue(node.data)))

        return new Attendance(data, labels)
    }
}
