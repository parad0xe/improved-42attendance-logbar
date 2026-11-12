import type { Labels } from "../labels"

const THEME_STORAGE_KEY = "improved-logbar-theme"

type Theme = "light" | "dark"

/**
 * @returns the theme chosen, or else the theme of the system
 */
function loadTheme(): Theme {
    try {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
        if (savedTheme !== null) {
            return savedTheme === "dark" ? "dark" : "light"
        }
    } catch {
        // The storage can be unavailable, for example in a private window.
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function saveTheme(theme: Theme): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme)
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
     * The theme chosen.
     */
    theme: Theme
    private switchElement: HTMLButtonElement

    constructor(labels: Labels) {
        this.theme = loadTheme()

        this.element = document.createElement("div")
        this.element.className = "improved-logbar-settings-row"
        this.element.textContent = labels.THEME

        this.switchElement = document.createElement("button")
        this.switchElement.type = "button"
        this.switchElement.className = "improved-logbar-theme-switch"
        this.switchElement.title = labels.THEME
        this.switchElement.setAttribute("aria-label", labels.THEME)

        this.switchElement.addEventListener("click", () => {
            this.theme = this.theme === "dark" ? "light" : "dark"
            saveTheme(this.theme)
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
        const isDark = this.theme === "dark"
        const root = document.documentElement
        if (root.classList.contains("dark") !== isDark) {
            root.classList.toggle("dark", isDark)
        }
        this.switchElement.textContent = isDark ? "☀" : "☾"
        this.switchElement.setAttribute("aria-pressed", String(isDark))
    }
}
