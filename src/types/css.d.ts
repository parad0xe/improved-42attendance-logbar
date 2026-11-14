// esbuild loads the .css files as text.
declare module "*.css" {
    const css: string
    export default css
}
