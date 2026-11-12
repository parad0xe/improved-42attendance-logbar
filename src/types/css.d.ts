// esbuild loads the .css files as text, see the loader in build.mjs.
declare module "*.css" {
    const css: string
    export default css
}
