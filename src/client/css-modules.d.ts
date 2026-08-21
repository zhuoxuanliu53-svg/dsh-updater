/** Ambient type for CSS Modules so tsc accepts `import css from './x.module.css'`. */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
