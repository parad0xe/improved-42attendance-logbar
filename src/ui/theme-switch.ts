import type { Labels } from "../labels"

const THEME_STORAGE_KEY = "improved-logbar-theme"

/**
 * @returns whether the dark theme was chosen, or else whether the system uses one
 */
function isDarkThemeChosen(): boolean {
    try {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
        if (savedTheme !== null) {
            return savedTheme === "dark"
        }
    } catch {
        // The storage can be unavailable, for example in a private window.
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function saveThemeChoice(isDark: boolean): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light")
    } catch {
        // Without storage, the choice lasts until the page is reloaded.
    }
}

/**
 * The switch between the light and dark themes, which keeps the chosen theme on the page.
 */
export class ThemeSwitch {
    /**
     * The row of the switch, with its label, for the settings to show.
     */
    element: HTMLElement
    /**
     * Whether the dark theme is chosen.
     */
    isDark: boolean
    private switchElement: HTMLButtonElement

    constructor(labels: Labels) {
        this.isDark = isDarkThemeChosen()

        this.element = document.createElement("div")
        this.element.className = "improved-logbar-settings-row"
        this.element.textContent = labels.THEME

        this.switchElement = document.createElement("button")
        this.switchElement.type = "button"
        this.switchElement.className = "improved-logbar-theme-switch"
        this.switchElement.title = labels.THEME
        this.switchElement.setAttribute("aria-label", labels.THEME)

        this.switchElement.addEventListener("click", () => {
            this.isDark = !this.isDark
            saveThemeChoice(this.isDark)
            this.render()
        })
        this.element.append(this.switchElement)
    }

    /**
     * Applies the chosen theme to the page, and again whenever the site changes it.
     */
    mount(): void {
        this.render()
        new MutationObserver(() => this.render()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    }

    /**
     * Applies the chosen theme to the page, and shows on the switch the theme it leads to.
     */
    private render(): void {
        const root = document.documentElement
        if (root.classList.contains("dark") !== this.isDark) {
            root.classList.toggle("dark", this.isDark)
        }
        this.switchElement.textContent = this.isDark ? "☀" : "☾"
        this.switchElement.setAttribute("aria-pressed", String(this.isDark))
    }
}
