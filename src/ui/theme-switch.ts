import type { Labels } from "../labels"

const THEME_STORAGE_KEY = "improved-attendance-theme"

type Theme = "light" | "dark"

/** Returns the theme chosen, or else the theme of the system. */
function loadTheme(): Theme {
    try {
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
        if (storedTheme !== null) {
            return storedTheme === "dark" ? "dark" : "light"
        }
    } catch {
        // The storage can be unavailable, for example in a private window.
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/**
 * Saves the theme chosen.
 * @param theme - the theme to save
 */
function saveTheme(theme: Theme): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
        // Without storage, the choice lasts until the page is reloaded.
    }
}

/** Renders the switch between the light and dark themes, and applies the chosen one to the page. */
export class ThemeSwitch {
    /** The row of the switch, with its label. */
    element: HTMLElement
    theme: Theme
    private switchElement: HTMLButtonElement

    /**
     * Creates the switch with the theme chosen.
     * @param labels - the labels in the language of the site
     */
    constructor(labels: Labels) {
        this.theme = loadTheme()

        this.element = document.createElement("div")
        this.element.className = "improved-attendance-settings-row"
        this.element.textContent = labels.SETTINGS_THEME

        this.switchElement = document.createElement("button")
        this.switchElement.type = "button"
        this.switchElement.className = "improved-attendance-theme-switch"
        this.switchElement.title = labels.SETTINGS_THEME
        this.switchElement.setAttribute("aria-label", labels.SETTINGS_THEME)

        this.switchElement.addEventListener("click", () => {
            this.theme = this.theme === "dark" ? "light" : "dark"
            saveTheme(this.theme)
            this.render()
        })
        this.element.append(this.switchElement)
    }

    /** Applies the chosen theme to the page, and keeps it applied. */
    mount(): void {
        this.render()
        new MutationObserver(() => this.render()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    }

    /** Renders the chosen theme on the page and on the switch. */
    private render(): void {
        const isDark = this.theme === "dark"
        const rootElement = document.documentElement
        if (rootElement.classList.contains("dark") !== isDark) {
            rootElement.classList.toggle("dark", isDark)
        }
        this.switchElement.textContent = isDark ? "☀" : "☾"
        this.switchElement.setAttribute("aria-pressed", String(isDark))
    }
}
